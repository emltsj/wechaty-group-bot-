# 群发图片目录 / Broadcast images

把群发用的图片放在这个目录，然后在 `.env` 里写相对路径，例如 `images/monday.jpg`。
Put broadcast images here and reference them from `.env` with a relative path, e.g. `images/monday.jpg`.

> 本目录下的图片默认被 `.gitignore` 忽略（可能含商业素材）。
> Images in this folder are git-ignored by default (they may be private assets).

## 约定文件名 / Suggested file names

`monday.jpg` `tuesday.jpg` `wednesday.jpg` `thursday.jpg` `friday.jpg`

多分店时可用 `store2-mon.jpg`、`store3-tue.jpg` 这类命名区分。
With multiple stores, use names like `store2-mon.jpg`, `store3-tue.jpg`.

## 支持格式 / Supported formats

`.jpg` `.jpeg` `.png` `.gif` `.webp`

## 说明 / Notes

- 路径可写相对项目根目录的路径，也可写绝对路径
  Paths may be relative to the project root or absolute
- 图片建议不超过 5MB / Keep files under ~5MB
- 替换图片不需要重启 / Replacing an image needs no restart
