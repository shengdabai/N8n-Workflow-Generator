import path from 'node:path'
import fs from 'node:fs/promises'

export async function safeWorkflowPath(
  directory: string,
  filename: string,
  options: { preserveEntry?: boolean } = {}
): Promise<string | null> {
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5][A-Za-z0-9._\u4e00-\u9fa5-]*\.json$/u.test(filename)) return null
  try {
    const base = await fs.realpath(directory)
    const entry = path.join(base, filename)
    if (options.preserveEntry) {
      const entryStat = await fs.lstat(entry)
      if (!entryStat.isFile() && !entryStat.isSymbolicLink()) return null
    }
    const target = await fs.realpath(entry)
    if (path.dirname(target) !== base || !(await fs.stat(target)).isFile()) return null
    // Unlink must remove the requested entry, never its resolved symlink target.
    return options.preserveEntry ? entry : target
  } catch {
    return null
  }
}
