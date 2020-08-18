import { Metadata } from "@saggitarius/metadata";
import { Typing } from "@saggitarius/typing";

export class Dumper {

    public dump(element: Metadata.Any): string {
        switch (element.kind) {
            case Metadata.Kind.Module:
                return this.dumpModule(element);
            case Metadata.Kind.Class:
                return this.dumpClass(element);
            case Metadata.Kind.Interface:
                return this.dumpInterface(element);
            case Metadata.Kind.Variable:
                return this.dumpVariable(element);
            case Metadata.Kind.Function:
                return this.dumpFunction(element);
            case Metadata.Kind.Method:
                return this.dumpMethod(element);
            case Metadata.Kind.Property:
                return this.dumpProperty(element);
            case Metadata.Kind.Constructor:
                return this.dumpConstructor(element);
            default:
                return "<unknown>";
        }
    }

    public dumpModule(element: Metadata.Module): string {
        return element.children.map((element) => this.dump(element)).join("\n");
    }

    public dumpClass(element: Metadata.Class): string {
        return this.dumpPrototype(element);
    }

    public dumpInterface(element: Metadata.Interface): string {
        return this.dumpPrototype(element);
    }

    public dumpVariable(element: Metadata.Variable): string {
        const type = element.constant ? "const" : "let";
        return `${type} ${this.dumpValue(element)}`;
    }

    public dumpFunction(element: Metadata.Function): string {
        return `function ${this.dumpCallable(element)}`;
    }

    public dumpProperty(element: Metadata.Property): string {
        return this.dumpMember(element) + this.dumpValue(element);
    }
 
    public dumpMethod(element: Metadata.Method): string {
        return this.dumpMember(element) + this.dumpCallable(element);
    }

    public dumpConstructor(element: Metadata.Constructor): string {
        return `constructor(${this.dumpParameters(element.parameters)})`;
    }

    public dumpMember(element: Metadata.Property|Metadata.Method): string {
        const prefixes: string[] = [];
        if (element.access) {
            prefixes.push(element.access);
        }
        if (element.static) {
            prefixes.push("static");
        }
        if (element.kind === Metadata.Kind.Method && element.abstract) {
            prefixes.push("abstract");
        }
        return prefixes.join(" ") + (prefixes.length ? " " : "");
    }

    public dumpCallable(element: Metadata.Method|Metadata.Function): string {
        const params = this.dumpParameters(element.parameters);
        const typeParams = this.dumpTypeIdParameters(element.typeParameters);
        const returnType = this.dumpTypeAnnotation(element.returnType);
        let name = this.dumpName(element);
        if (element.async) {
            name = `async ${name}`;
        }
        if (element.generator) {
            name = `${name}*`;
        }
        return `${name}${typeParams}(${params})${returnType}`;
    }

    public dumpPrototype(element: Metadata.Class|Metadata.Interface): string {
        const head: string[] = [];
        if (element.kind === Metadata.Kind.Class && element.abstract) {
            head.push("abstract");
        }
        head.push(element.kind, this.dumpName(element) + this.dumpTypeIdParameters(element.typeParameters));
        if (element.extends) {
            head.push("extends", this.dumpTypeList(element.extends));
        }
        if (element.kind === Metadata.Kind.Class && element.implements) {
            head.push("implements", this.dumpTypeList(element.implements));
        }
        const body: string[] = [];
        for (const property of element.properties) {
            body.push(this.dumpProperty(property));
        }
        if (element.kind === Metadata.Kind.Class && element.constructor) {
            body.push(this.dumpConstructor(element.constructor));
        }
        for (const method of element.methods) {
            body.push(this.dumpMethod(method));
        }
        const header = head.join(" ");
        const content = (body.length ? "\n" : "") + body.map((line) => "\t" + line).join("\n") + (body.length ? "\n" : "");
        return `${header} {${content}}`;
    }

    public dumpParameters(params?: Metadata.Parameter[]): string {
        if (params) {
            return params.map((param) => this.dumpParameter(param)).join(", ");
        }
        return "";
    }

    public dumpParameter(param: Metadata.Parameter): string {
        const prefix = param.rest ? "..." : "";
        return prefix + this.dumpValue(param);
    }

    public dumpValue(val: Metadata.Variable|Metadata.Property|Metadata.Parameter): string {
        const suffixes = [];
        if (val.kind === Metadata.Kind.Property || val.kind === Metadata.Kind.Parameter) {
            if (val.optional) {
                suffixes.push("?");
            }
        }

        return this.dumpName(val) + suffixes.join(" ") + this.dumpTypeAnnotation(val.type);
    }

    public dumpName(element: Metadata.Variable|Metadata.Property|Metadata.Parameter|Metadata.Function|Metadata.Method|Metadata.Class|Metadata.Interface): string {
        if (element.name) {
            return element.name;
        }
        if (element.kind === Metadata.Kind.Parameter) {
            return `$${element.index}`;
        }
        return "_";
    }

    public dumpTypeList(types?: Metadata.TypeReference[]|Metadata.TypeReference): string {
        if (types) {
            if (Array.isArray(types)) {
                return types.map((type) => this.dumpType(type)).join(", ");
            }
            return this.dumpType(types);
        }
        return "";
    }

    public dumpTypeAnnotation(type?: Metadata.TypeReference): string {
        const str = type ? this.dumpType(type) : "";
        return str ? `: ${str}` : "";
    }

    public dumpType(type: Metadata.TypeReference): string {
        return this.dumpTypeIdentifier(type.name) + this.dumpTypeParameters(type.typeParameters);
    }

    public dumpTypeIdParameters(params?: Metadata.TypeIdentifier[]): string {
        if (params) {
            const body = params.map((param) => this.dumpTypeIdentifier(param)).join(", ");
            return `<${body}>`;
        }
        return "";
    }

    public dumpTypeParameters(params?: Metadata.TypeReference[]): string {
        if (params) {
            const body = params.map((param) => this.dumpType(param)).join(", ");
            return `<${body}>`;
        }
        return "";
    }

    public dumpTypeIdentifier(type: Metadata.TypeIdentifier): string {
        return typeof(type) !== "string"
            ? Typing.nameOf(type)
            : type;
    }
}
