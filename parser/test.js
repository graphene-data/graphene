import { parser } from './parser.js';

const testStatements = [
  "create table users (id integer, name varchar(100), email text);",
  "select * from users;",
  "select id, name from users where id = 1;",
  "select u.name, o.total from users u join orders o on u.id = o.user_id;"
];

console.log("Testing SQL Parser\n");

testStatements.forEach((sql, index) => {
  console.log(`Test ${index + 1}: ${sql}`);
  
  const tree = parser.parse(sql);
  
  function printTree(node, indent = '') {
    const type = node.type.name;
    const from = node.from;
    const to = node.to;
    const content = sql.substring(from, to);
    
    console.log(`${indent}${type} [${from}-${to}]: "${content}"`);
    
    let child = node.firstChild;
    while (child) {
      printTree(child, indent + '  ');
      child = child.nextSibling;
    }
  }
  
  printTree(tree.topNode);
  console.log('\n');
});