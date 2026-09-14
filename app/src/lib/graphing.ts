/** A small mathematical expression parser. Never executes JavaScript or accesses objects. */
export type GraphFunction = (x:number,y?:number,a?:number)=>number;
const functions:Record<string,(n:number)=>number>={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp,floor:Math.floor,ceil:Math.ceil};
export function compileExpression(source:string):GraphFunction {
  const clean=source.toLowerCase().replace(/π/g,'pi').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').trim();
  if(clean.length>400)throw new Error('Use an expression shorter than 400 characters.');
  const tokens=clean.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^]/g)||[];
  if(tokens.join('')!==clean.replace(/\s/g,''))throw new Error('Use numbers, x, y, a, parentheses and mathematical functions.');
  let at=0,depth=0;
  const peek=()=>tokens[at];
  const take=()=>tokens[at++];
  type Node=(x:number,y:number,a:number)=>number;
  function atom():Node {
    if(++depth>60)throw new Error('This expression is too deeply nested.');
    const token=take();let node:Node;
    if(token==='('){node=add();if(take()!==')')throw new Error('Close the parenthesis.');}
    else if(token==='x')node=x=>x;
    else if(token==='y')node=(_x,y)=>y;
    else if(token==='a')node=(_x,_y,a)=>a;
    else if(token==='pi')node=()=>Math.PI;
    else if(token==='e')node=()=>Math.E;
    else if(Object.hasOwn(functions,token)){if(take()!=='(')throw new Error(`Use ${token}(x).`);const arg=add();if(take()!==')')throw new Error('Close the function parenthesis.');node=(x,y,a)=>functions[token](arg(x,y,a));}
    else if(token && /^\d|^\./.test(token)){const n=Number(token);node=()=>n;}
    else throw new Error(`Expected a number or variable${token?`, found “${token}”`:''}.`);
    depth--;return node;
  }
  function power():Node{const left=atom();if(peek()==='^'){take();const right=unary();return(x,y,a)=>left(x,y,a)**right(x,y,a);}return left;}
  function unary():Node{if(peek()==='-'){take();const n=unary();return(x,y,a)=>-n(x,y,a);}if(peek()==='+'){take();return unary();}return power();}
  function multiply():Node{let left=unary();while(peek()==='*'||peek()==='/'||(peek() && /^(?:[a-z]|\d|\.|\()/.test(peek()))){const operation=peek()==='/'?take():peek()==='*'?take():'*';const right=unary(),previous=left;left=operation==='/'?(x,y,a)=>previous(x,y,a)/right(x,y,a):(x,y,a)=>previous(x,y,a)*right(x,y,a);}return left;}
  function add():Node{let left=multiply();while(peek()==='+'||peek()==='-'){const op=take(),right=multiply(),previous=left;left=op==='+'?(x,y,a)=>previous(x,y,a)+right(x,y,a):(x,y,a)=>previous(x,y,a)-right(x,y,a);}return left;}
  const node=add();if(at!==tokens.length)throw new Error('Check the parentheses and operators.');
  return(x,y=0,a=1)=>node(x,y,a);
}
export function compileGraph(source:string):{implicit:boolean;evaluate:GraphFunction}{
 const sides=source.split('=');if(sides.length>2)throw new Error('Use one equals sign.');
 if(sides.length===1)return{implicit:false,evaluate:compileExpression(source)};
 if(sides[0].trim()==='y'||sides[0].trim()==='f(x)')return{implicit:false,evaluate:compileExpression(sides[1])};
 const left=compileExpression(sides[0]),right=compileExpression(sides[1]);return{implicit:true,evaluate:(x,y,a)=>left(x,y,a)-right(x,y,a)};
}
export interface GraphWindow {x:number;y:number;span:number}
export function graphPath(fn:GraphFunction,implicit:boolean,view:GraphWindow,a=1):string {
 const minX=view.x-view.span/2,maxY=view.y+view.span/2,scale=600/view.span;
 if(!implicit){let path='',prev=NaN;for(let i=0;i<=700;i++){const x=minX+i/700*view.span,y=fn(x,0,a),px=i/700*600,py=(maxY-y)*scale;if(!Number.isFinite(py)||Math.abs(py)>3000){prev=NaN;continue;}path+=`${!Number.isFinite(prev)||Math.abs(prev-py)>500?'M':'L'}${px.toFixed(2)},${py.toFixed(2)} `;prev=py;}return path;}
 const n=70,step=view.span/n;let path='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
 const points=[[c*600/n,r*600/n],[(c+1)*600/n,r*600/n],[(c+1)*600/n,(r+1)*600/n],[c*600/n,(r+1)*600/n]];
 const v=[fn(minX+c*step,maxY-r*step,a),fn(minX+(c+1)*step,maxY-r*step,a),fn(minX+(c+1)*step,maxY-(r+1)*step,a),fn(minX+c*step,maxY-(r+1)*step,a)];
 const cuts:number[][]=[];for(let e=0;e<4;e++){const j=(e+1)%4;if(!Number.isFinite(v[e])||!Number.isFinite(v[j])|| (v[e]<0)===(v[j]<0))continue;const t=v[e]/(v[e]-v[j]);cuts.push([points[e][0]+t*(points[j][0]-points[e][0]),points[e][1]+t*(points[j][1]-points[e][1])]);}
 for(let j=0;j+1<cuts.length;j+=2)path+=`M${cuts[j][0].toFixed(2)},${cuts[j][1].toFixed(2)}L${cuts[j+1][0].toFixed(2)},${cuts[j+1][1].toFixed(2)} `;
 }return path;
}
