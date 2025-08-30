import path from "path"

// let origCwd = process.cwd
// let hackDone = false

// process.cwd = () => {
//   if (hackDone) return origCwd.call(process)
//   const err = new Error();
//   const stack = err.stack?.split("\n") || []
//   if (stack.find(l => l.indexOf('@sveltejs/kit/src/exports/vite/index.js') > -1)) {
//     return path.join()
//   }
//   return origCwd.call(process)
// }

export let grapheneRoot = process.cwd()
process.chdir(path.join(process.cwd(), '.evidence/template'))
