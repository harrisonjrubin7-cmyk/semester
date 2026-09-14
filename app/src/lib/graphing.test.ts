import {describe,it,expect} from 'vitest';
import {compileExpression,compileGraph,graphPath} from './graphing';
describe('graph expression evaluation',()=>{
 it('supports precedence, implicit products and right-associative powers',()=>{expect(compileExpression('-x^2 + 2x + 1')(3)).toBe(-2);expect(compileExpression('2^3^2')(0)).toBe(512);expect(compileExpression('2(x+1)')(4)).toBe(10);expect(compileExpression('2^-2')(0)).toBe(.25);});
 it('uses radians, parameters and constants',()=>{expect(compileExpression('a*sin(pi/2)')(0,0,3)).toBeCloseTo(3);expect(compileExpression('sqrt(9)+ln(e)')(0)).toBeCloseTo(4);});
 it('rejects object access, constructors and malformed expressions',()=>{for(const input of ['constructor(1)','window.alert(1)','x;alert(1)','sin(x','x +','2**3','x = 1'])expect(()=>compileExpression(input),input).toThrow();});
 it('represents implicit equations independently of explicit functions',()=>{const circle=compileGraph('x^2+y^2=4');expect(circle.implicit).toBe(true);expect(circle.evaluate(0,2)).toBe(0);expect(compileGraph('y=x^2').evaluate(3)).toBe(9);expect(()=>compileGraph('x=y=4')).toThrow();});
 it('creates bounded finite paths and splits discontinuities',()=>{const view={x:0,y:0,span:20};const path=graphPath(compileExpression('1/x'),false,view);expect(path).not.toMatch(/NaN|Infinity/);expect(path.split('M').length).toBeGreaterThan(2);const circle=compileGraph('x^2+y^2=4');expect(graphPath(circle.evaluate,true,view).length).toBeGreaterThan(100);});
});
