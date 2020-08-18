import { Parser } from "./index";
import { Dumper } from "./dumper";

// const source = `
// import { IdType } from "@id";

// export namespace Test {
//     export const Id: IdType = 1;
// }

// export let variable: test = 1, test = "lorem";
// let xxx = [];
// export const Max = 123.3;
// `;

// const source = `
// const a, b;
// let c, d;
// var e, f;
// function test(a, b, c) {
//     var d = c - b;
//     return a * d;
// }
// `;


const source = `
import { D } from "./xxx";
interface AS {}
interface Lorem<T> extends AS {
    greeting(v: T): string;
}
abstract class Foo<T> {}
export class Test extends Foo<string> implements Lorem<number>, AS {
    private static name: string;
    constructor(private a: AS, public b?: Lorem<AS>, c = 13) {

    }
    public greeting(v?: number): string {
        
    }
}
let index: number = 0;
function aaa(l: Lorem<number>): void {
    l.greeting(index);
}
`;

(async () => {
    const parser = new Parser(["typescript", "classProperties"]);
    const module = await parser.parse("tmp.ts", source);
    const writer = new Dumper();
    console.log(writer.dump(module));
})();

