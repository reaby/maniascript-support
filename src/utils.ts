/**
 * remove duplicates by property
 *
 * @export
 * @param {*} arr
 * @param {string} prop
 * @returns {*}
 */
export function removeDuplicates(arr: any, prop: string): any {
  return arr
    .slice()
    .reverse()
    .filter(
      (v: any, i: any, a: any) =>
        a.findIndex((t: any) => t[prop] === v[prop]) === i
    )
    .reverse();
}
