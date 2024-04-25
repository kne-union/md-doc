### stringify

#### API

| 属性名     | 说明                 | 类型          | 默认值  |
|---------|--------------------|-------------|------|
| baseDir | 需要解析的 readme.md 文件 | DataOptions | ''   |
| output  | 是否需要生成解析出来的文件      | boolean     | true |
| name    | 自定义 name           | string      | ''   |

#### Output 执行后返回值

****如果 output 为 true，则不返回数据，直接在传入的或当前目录下生成 README.md 文件，否则：****

| 属性名    | 说明              | 类型          | 默认值 |
|--------|-----------------|-------------|-----|
| data   | 解析路径文件格式化后的数据   | DataOptions | ''  |
| readme | 解析路径文件后新生成的md数据 | string      | ''  |

#### DataOptions

| 属性名         | 说明                                 | 类型     | 默认值 |
|-------------|------------------------------------|--------|-----|
| api         | 根据路径解析出的 api.md 数据                 | string | ''  |
| description | 根据路径解析出的 example.json 数据中 list 格式化 | string | ''  |
| example     | 根据路径解析出并格式化的 example.json 数据       | string | ''  |
| name        | 组件 name 或 package 的 name           | string | ''  |
| summary     | 根据路径解析出的 summary.md 数据             | string | ''  |

### parse

#### API

| 属性名          | 说明                 | 类型     | 默认值 |
|--------------|--------------------|--------|-----|
| readmeString | 需要解析的 readme.md 文件 | string | ''  |
