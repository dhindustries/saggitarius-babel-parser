import { parse, ParserPlugin } from "@babel/parser";
import * as types from "@babel/types";
import { Metadata } from "@saggitarius/metadata";
import { Primitives } from "@saggitarius/typing";
import { 
    ModuleBuilder, 
    IModuleBuilder, 
    IClassBuilder, 
    ICallableBuilder,
    IMemberBuilder,
    IPrototypeBuilder,
    IConstructorBuilder,
    IPropertyBuilder,
} from "@saggitarius/metadata/dist/builder";

export class Parser { 

    public constructor(
        private plugins: ParserPlugin[] = [],
    ) {}

    public parse(path: string, source: string): Promise<Metadata.Module> {

        const ast = parse(source, {
            sourceFilename: path,
            sourceType: "module",
            plugins: this.plugins,
        });
        const module: Metadata.Module = {
            kind: Metadata.Kind.Module,
            imports: {},
            exports: {},
            path: path,
            children: [],
        };
        const builder = new ModuleBuilder(module);

        for (let statement of ast.program.body) {
            if (types.isImportDeclaration(statement)) {
                console.log(statement);
            } else if (types.isExportNamedDeclaration(statement)) {
                statement = statement.declaration;
            }
            if (types.isClassDeclaration(statement)) {
                this.parseClass(builder, statement);
            } else if (types.isTSInterfaceDeclaration(statement)) {
                this.parseInterface(builder, statement);
            } else if (types.isVariableDeclaration(statement)) {
                this.parseVariables(builder, statement);
            } else if (types.isFunctionDeclaration(statement)) {
                this.parseFunction(builder, statement);
            }
        }

        return Promise.resolve(module);
    }

    private parseFunction(builder: IModuleBuilder, declaration: types.FunctionDeclaration) {
        const fn = builder.addFunction(declaration.id.name);
        this.parseCallable(fn, declaration);
    }

    private parseVariables(builder: IModuleBuilder, declaration: types.VariableDeclaration) {
        const isConstant = declaration.kind === "const";
        for (const variable of declaration.declarations) {
            if (types.isIdentifier(variable.id)) {
                const varBuilder = builder.addVariable(variable.id.name);
                varBuilder.setConstant(isConstant);
                varBuilder.setType(
                    this.parseTypeAnnotation(variable.id.typeAnnotation)
                );
            }
        }
    }

    private parseClass(builder: IModuleBuilder, declaration: types.ClassDeclaration) {
        const cls = builder.addClass(declaration.id.name);
        cls.setAbstract(declaration.abstract);
        cls.setExtends(
            this.parseTypeReference(declaration.superClass, declaration.superTypeParameters)
        );
        if (declaration.implements) {
            cls.addImplements(
                declaration.implements.map((impl) => {
                    return types.isTSExpressionWithTypeArguments(impl)
                    ? this.parseTypeReference(impl.expression, impl.typeParameters)
                    : this.parseTypeReference(impl.id, impl.typeParameters);
                })
            );
        }
        cls.addTypeParams(
            this.parseTypeParameters(declaration.typeParameters)
        );

        for (const statement of declaration.body.body) {
            if (types.isClassMethod(statement)) {
                if (statement.kind === "method") {
                    this.parseMethod(cls, statement);
                } else if (statement.kind === "constructor") {
                    this.parseConstructor(cls, statement);
                }
            } else if (types.isClassProperty(statement)) {
                this.parseProperty(cls, statement);
            }
        }
    }

    private parseInterface(builder: IModuleBuilder, declaration: types.TSInterfaceDeclaration) {
        const ifce = builder.addInterface(declaration.id.name);
        ifce.addTypeParams(
            this.parseTypeParameters(declaration.typeParameters)
        );
        if (declaration.extends) {
            ifce.addExtends(
                declaration.extends.map((extend) => {
                    return this.parseTypeReference(extend.expression, extend.typeParameters);
                })
            );
        }
        for (const element of declaration.body.body) {
            if (types.isTSPropertySignature(element)) {
                this.parsePropertySignature(ifce, element);
            } else if (types.isTSMethodSignature(element)) {
                this.parseMethodSignature(ifce, element);
            }
        }
    }

    private parseConstructor(builder: IClassBuilder, declaration: types.ClassMethod) {
        const ctor = builder.addConstructor();
        this.parseParameters(ctor, declaration.params);
    }

    private parseMethod(builder: IPrototypeBuilder, declaration: types.ClassMethod) {
        const method = builder.addMethod();
        method.setAbstract(
            declaration.abstract
        );
        this.parseMember(method, declaration);
        this.parseCallable(method, declaration);
    }

    private parseMethodSignature(builder: IPrototypeBuilder, declaration: types.TSMethodSignature) {
        const method = builder.addMethod();
        method.setReturnType(
            this.parseTypeAnnotation(declaration.typeAnnotation)
        );
        method.addTypeParams(
            this.parseTypeParameters(declaration.typeParameters)
        );
        this.parseMemberSignature(method, declaration);
    }

    private parseProperty(builder: IPrototypeBuilder, declaration: types.ClassProperty) {
        const property = builder.addProperty();
        property.setType(
            this.parseTypeAnnotation(declaration.typeAnnotation)
        );
        property.setReadonly(
            declaration.readonly
        );
        if (types.isIdentifier(declaration.key)) {
            property.setOptional(
                declaration.key.optional
            );
        }
        this.parseMember(property, declaration);
    }

    private parsePropertySignature(builder: IPrototypeBuilder, declaration: types.TSPropertySignature) {
        const property = builder.addProperty();
        property.setType(
            this.parseTypeAnnotation(declaration.typeAnnotation)
        );
        property.setReadonly(
            declaration.readonly
        );
        if (types.isIdentifier(declaration.key)) {
            property.setOptional(
                declaration.key.optional
            );
        }
        this.parseMemberSignature(property, declaration);
    }

    private parseMember(builder: IMemberBuilder, declaration: types.ClassMethod|types.ClassProperty) {
        builder.setName(
            this.parseName(declaration.key)
        );
        builder.setAccess(
            this.parseAccess(declaration.accessibility)
        );
        builder.setStatic(declaration.static);
    }

    private parseMemberSignature(builder: IMemberBuilder, declaration: types.TSPropertySignature|types.TSMethodSignature) {
        builder.setName(
            this.parseName(declaration.key)
        );
    }

    private parseCallable(builder: ICallableBuilder, declaration: types.Function) {
        builder.setReturnType(
            this.parseTypeAnnotation(declaration.returnType)
        );
        builder.addTypeParams(
            this.parseTypeParameters(declaration.typeParameters)
        );
        this.parseParameters(builder, declaration.params);
    }

    private parseParameters(builder: ICallableBuilder | IConstructorBuilder, params: Array<types.Identifier | types.Pattern | types.RestElement | types.TSParameterProperty>) {
        for (let index = 0; index < params.length; index++) {
            let param = params[index];
            const paramBuilder = builder.addParameter(index);
            let prop: IPropertyBuilder;
            let optional: boolean = false;

            if (types.isTSParameterProperty(param)) {
                if ("addProperty" in builder) {
                    prop = builder.addProperty();
                    prop.setAccess(
                        this.parseAccess(param.accessibility)
                    );
                    prop.setReadonly(
                        param.readonly
                    );
                }
                param = param.parameter;
            }

            paramBuilder.setType(this.parseTypeAnnotation(param.typeAnnotation));
            if (prop) {
                prop.setType(this.parseTypeAnnotation(param.typeAnnotation));
            }
            if (types.isAssignmentPattern(param)) {
                optional = true;
                if (!types.isMemberExpression(param.left)) {
                    param = param.left;
                }
            }

            if (types.isRestElement(param)) {
                paramBuilder.setRest(true);
                if (types.isIdentifier(param.argument)) {
                    param = param.argument;
                }
            } 
            if (types.isIdentifier(param)) {
                paramBuilder.setName(param.name);
                paramBuilder.setOptional(optional || param.optional);
                if (prop) {
                    prop.setName(param.name);
                    prop.setOptional(optional || param.optional);
                }
            }
        }
    }

    private parseTypeAnnotation(declaration: types.TSTypeAnnotation|types.TypeAnnotation|types.Noop): Metadata.TypeReference|undefined {
        if (types.isTSTypeAnnotation(declaration)) {
            return this.parseType(declaration.typeAnnotation);
        }
        return undefined;
    }

    // | | |  | TSNullKeyword 
    // | |  |  |  | TSUndefinedKeyword | 
    //  | | TSThisType | TSFunctionType | TSConstructorType | TSTypeReference | 
    // TSTypePredicate | TSTypeQuery | TSTypeLiteral | TSArrayType | TSTupleType | TSOptionalType | TSRestType | TSUnionType | 
    // TSIntersectionType | TSConditionalType | TSInferType | TSParenthesizedType | TSTypeOperator | TSIndexedAccessType | 
    // TSMappedType | TSLiteralType | TSExpressionWithTypeArguments | TSImportType
    private parseType(declaration: types.TSType|types.FlowType): Metadata.TypeReference|undefined {
        if (types.isTSTypeReference(declaration)) {
            return this.parseTypeReference(declaration);
        }
        const primitive = this.parsePrimitiveType(declaration);
        if (primitive) {
            return { 
                kind: Metadata.Kind.Type,
                name: primitive,
            };
        }
        return undefined;
    }

    private parseTypeParameters(declaration: types.TypeParameterDeclaration|types.TSTypeParameterDeclaration|types.Noop): Metadata.TypeIdentifier[]|undefined {
        if (declaration && !types.isNoop(declaration)) {
            const params: Metadata.TypeIdentifier[] = [];
            for (const param of declaration.params) {
                params.push(param.name);
            }
            return params;
        }
        return undefined;
    }

    private parseTypeReference(name: types.Node, params?: types.TypeParameterInstantiation|types.TSTypeParameterInstantiation): Metadata.TypeReference|undefined {
        if (types.isTSTypeReference(name)) {
            params = name.typeParameters;
            name = name.typeName;
        }
        if (types.isIdentifier(name)) {
            const type: Metadata.TypeReference = {
                kind: Metadata.Kind.Type,
                name: name.name,
            };
            if (params) {
                type.typeParameters = [];
                for (const param of params.params) {
                    type.typeParameters.push(this.parseType(param));
                }
            }
            return type;
        }
        return undefined;
    }

    private parsePrimitiveType(declaration: types.TSType|types.FlowType): Metadata.TypeIdentifier|undefined {
        switch (true) {
            case types.isTSAnyKeyword(declaration):
            case types.isTSUnknownKeyword(declaration):
                return Primitives.Unknown;
            case types.isTSUndefinedKeyword(declaration):
                return Primitives.Undefined;
            case types.isTSNeverKeyword(declaration):
            case types.isTSVoidKeyword(declaration):
                return Primitives.Void;
            case types.isTSBooleanKeyword(declaration):
                return Primitives.Boolean;
            case types.isTSBigIntKeyword(declaration):
                return Primitives.Bigint;
            case types.isTSNumberKeyword(declaration):
                return Primitives.Number;
            case types.isTSStringKeyword(declaration):
                return Primitives.String;
            case types.isTSSymbolKeyword(declaration):
                return Primitives.Symbol;
            case types.isTSObjectKeyword(declaration):
            case types.isTSNullKeyword(declaration):
                return Primitives.Object;
        }
        return undefined;
    }

    private parseName(node: types.Node): string | undefined {
        if (types.isIdentifier(node)) {
            return node.name;
        }
        return undefined;
    }

    private parseAccess(access: "public"|"protected"|"private"): Metadata.Access {
        return {
            "public": Metadata.Access.Public,
            "protected": Metadata.Access.Protected,
            "private": Metadata.Access.Private,
        }[access];
    }
}