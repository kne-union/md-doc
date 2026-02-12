# md-doc

### 描述

转换readme.md文件

### 安装

```shell
npm i --save @kne/md-doc
```

### 概述

这是一个强大的 Markdown 文档转换工具，专为组件库和模块化项目设计。它能够智能解析并生成结构化的文档，让你的 README.md 文档维护变得轻松高效。

该工具的核心优势在于其双向转换能力：
- **stringify**: 将分散的文档片段（摘要、API、示例代码等）智能合并成一个完整的 README.md 文件
- **parse**: 将已有的 README.md 文件反向解析为结构化数据，便于后续处理和展示

特别适合组件库文档生成场景，支持：
- 自动读取 doc/ 目录下的文档片段文件
- 智能解析示例代码及其依赖关系
- 自动处理 SCSS 样式并生成独立的 className
- 支持从外部引用参考文档的 README
- 支持全屏示例模式

使用该工具，你可以将复杂的文档拆分为易于维护的独立文件，然后一键生成美观的统一文档，大幅提升文档编写效率。

### stringify

根据目录地址编译并格式化数据，返回数据或将数据导出为 README.md 文件

#### 工作流程

1. 获取目录地址（默认为当前工作目录）
2. 读取 doc/ 目录下的固定文件（api.md、summary.md、example.json、style.css/scss、package.json）
3. 解析 example.list 数据，读取其中 code 字段指定的文件内容并重新赋值
4. 获取组件名称（优先使用传入的 name，否则使用 package.json 中的 name）
5. 格式化所有数据，生成新的 README.md 内容
6. 根据 output 参数决定是直接写入文件还是返回数据

#### 输出模式

**output 为 true**：直接在指定目录下生成 README.md 文件

**output 为 false**：返回包含以下字段的对象：
- readme：生成的 README.md 完整内容
- data：结构化的文档数据
  - name：组件名称
  - description：组件描述
  - summary：摘要内容（HTML 格式）
  - example：示例数据（包含 className、style、list 等）
  - api：API 文档内容（HTML 格式）

### parse

接收读取到的 README.md 文件数据，返回一个格式化后的 Object

#### 解析功能

- name：提取 H1 标题作为组件名称
- summary：提取"概述"部分的内容
- api：提取"API"部分的内容
- example：提取并解析"示例"部分
  - 自动识别全屏示例模式
  - 解析示例样式（SCSS），生成 className 和 style
  - 解析示例代码列表，包括标题、描述、依赖范围（scope）和代码内容

#### example 数据结构

解析后的 example 对象包含：

```json
{
  "isFull": false,
  "className": "[name]_[hash]",
  "style": ".[name]_[hash]{...css...}",
  "list": [
    {
      "title": "示例标题",
      "description": "示例说明",
      "scope": [
        {
          "name": "组件名",
          "packageName": "包名",
          "importStatement": "导入语句"
        }
      ],
      "code": "示例代码字符串"
    }
  ]
}
```

这个反解析功能特别适合将已有的 README.md 文档转换为组件文档系统所需的结构化数据，实现文档的自动化管理和展示。


### 示例

### API

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
