# 群发图片目录 / Broadcast images

把群发用的图片放在这个目录，然后在 `.env` 里写相对路径，例如 `images/monday.jpg`。
Put broadcast images here and reference them from `.env` with a relative path, e.g. `images/monday.jpg`.

> 本目录下的图片默认被 `.gitignore` 忽略（可能含商业素材）。
> Images in this folder are git-ignored by default (they may be private assets).

## 约定文件名 / Suggested file names

| 文件名 / File | 用途 / Purpose |
| --- | --- |
| `monday.jpg` | 周一特殊群发 / Monday special |
| `tuesday.jpg` | 周二特殊群发 / Tuesday special |
| `wednesday.jpg` | 周三特殊群发 / Wednesday special |
| `thursday.jpg` | 周四特殊群发 / Thursday special |
| `friday.jpg` | 周五特殊群发 / Friday special |

## 支持格式 / Supported formats

`.jpg` `.jpeg` `.png` `.gif` `.webp`

## 说明 / Notes

- 路径可写相对项目根目录的路径，也可写绝对路径
  Paths may be relative to the project root or absolute
- 图片建议不超过 5MB，避免发送过慢
  Keep files under ~5MB for faster delivery
- 替换图片不需要重启，下次群发会自动使用新文件
  Replacing an image needs no restart; the next broadcast uses the new file
