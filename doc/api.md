### stringify

#### 参数

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| baseDir | 需要解析的目录路径 | string | 当前工作目录 |
| output | 是否需要生成解析出来的 README.md 文件 | boolean | true |
| name | 自定义组件名称 | string | 从 package.json 读取 |

#### 返回值

当 `output` 为 true 时，不返回数据，直接在传入目录下生成 README.md 文件。

当 `output` 为 false 时，返回：

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| readme | 解析后新生成的 README.md 完整内容 | string | '' |
| data | 解析路径文件格式化后的结构化数据 | DataOptions | - |

#### DataOptions 数据结构

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| name | 组件名称 | string | '' |
| packageName | npm 包名 | string | '' |
| description | 组件描述 | string | '' |
| summary | 概述内容（HTML 格式） | string | '' |
| example | 示例数据（包含 className、style、list） | object | - |
| api | API 文档内容（HTML 格式） | string | '' |

### parse

#### 参数

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| readmeString | 需要解析的 README.md 文件内容 | string | - |

#### 返回值

返回解析后的结构化对象：

| 属性名 | 说明 | 类型 |
|--------|------|------|
| name | 解析出的组件名称（H1 标题） | string |
| summary | 解析出的概述内容 | string |
| api | 解析出的 API 文档内容 | string |
| example | 解析出的示例数据 | object |

#### example 返回对象结构

| 属性名 | 说明 | 类型 |
|--------|------|------|
| isFull | 是否为全屏示例模式 | boolean |
| className | 生成的样式类名 | string |
| style | 生成的 CSS 样式 | string |
| list | 示例代码列表 | array |

#### list 数组项结构

| 属性名 | 说明 | 类型 |
|--------|------|------|
| title | 示例标题 | string |
| description | 示例说明 | string |
| scope | 依赖范围（包含 name、packageName、importStatement） | array |
| code | 示例代码内容 | string |

### 辅助函数

#### styleTransform

样式转换函数，将样式字符串转换为 className 和 CSS

| 参数名 | 说明 | 类型 |
|--------|------|------|
| name | 组件名称 | string |
| styleString | 样式字符串（可能包含 SCSS） | string |

#### 返回值

| 属性名 | 说明 | 类型 |
|--------|------|------|
| className | 生成的唯一样式类名 | string |
| style | 编译后的 CSS | string |

#### 注意

- 需要 sass 模块支持 SCSS 编译
- 使用 MD5 生成唯一的样式类名
- 如果未安装 sass，则返回空样式
