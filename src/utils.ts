export function removeDuplicates(arr: any): any {
  return arr
    .slice()
    .reverse()
    .filter(
      (v: any, i: any, a: any) => a.findIndex((t: any) => t.name === v.name) === i
    )
    .reverse();
}
