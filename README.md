# md-doc

### 描述

转换readme.md文件

### 安装

```shell
npm i --save @kne/md-doc
```

### 概述

`@kne/md-doc` 是面向组件库与模块化项目的 Markdown 文档工具，负责在**分散的 doc 源文件**与**统一的 README.md**之间双向转换，供文档站点、示例驱动器（example-driver）等下游系统消费。

## 核心能力

- **stringify**：读取 `doc/` 目录下的文档片段，合并生成完整的 `README.md`
- **parse**：将 `README.md` 反向解析为结构化数据（名称、概述、示例、API）
- **示例引用**：支持整包引用与单项引用，复用其他 npm 包已有示例
- **样式编译**：将 `style.scss` / `style.css` 编译为独立 `className` 与内联 CSS
- **CLI 工具**：通过 `create-md` 命令一键生成，并支持 `--watch` 监听变更

## 适用场景

- 组件库将 API、概述、示例代码拆分为独立文件维护
- 封装层组件（如 `@components/File`）引用底层包（如 `@kne/react-file`）的示例，避免重复编写
- 将 README 解析为 JSON，供在线文档、示例预览系统使用

## 目录结构

在需要生成文档的包根目录下创建 `doc/` 目录：

```
your-package/
├── package.json
├── README.md          # stringify 自动生成，勿手改
└── doc/
    ├── summary.md     # 概述（必填推荐）
    ├── api.md         # API 文档（必填推荐）
    ├── example.json   # 示例配置（可选）
    ├── style.scss     # 示例样式（可选）
    └── *.js           # 示例代码文件
```

`stringify` 会读取以下文件：

| 文件 | 说明 |
|------|------|
| `doc/summary.md` | 写入 README 的「概述」章节 |
| `doc/api.md` | 写入 README 的「API」章节 |
| `doc/example.json` | 示例列表配置 |
| `doc/style.scss` / `doc/style.css` | 示例全局样式（优先 scss） |
| `package.json` | 包名、描述，用于生成标题与安装说明 |

## stringify 工作流程

1. 读取 `baseDir` 下 `doc/` 中的源文件与 `package.json`
2. 解析 `example.json` 的 `list`：
   - 对含 `reference` + `path` 的条目，从引用包加载示例
   - 对其余条目，读取 `code` 指向的本地 `.js` 文件
3. 若 `example.json` 根节点含 `reference`，以引用包 README 为基础，将本地 `list` 追加到引用示例之后
4. 否则按模板生成完整 README（描述、安装、概述、示例、API）
5. 写入 `README.md` 或返回结构化数据

## example.json 配置

### 基础结构

```json
{
  "isFull": false,
  "list": [
    {
      "title": "基础示例",
      "description": "示例说明",
      "code": "./base.js",
      "scope": [
        { "name": "_Button", "packageName": "@components/Button" },
        { "name": "antd", "packageName": "antd" }
      ]
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `isFull` | 为 `true` 时，示例区域标题显示为「示例(全屏)」 |
| `list` | 示例条目数组 |
| `list[].title` | 示例标题 |
| `list[].description` | 示例说明 |
| `list[].code` | 相对 `doc/` 的示例代码文件路径，如 `./base.js` |
| `list[].scope` | 示例运行时的依赖声明 |
| `list[].isFull` | 单条示例是否全屏展示，标题后追加 `(全屏)` |

### scope 依赖声明

| 场景 | name | packageName |
|------|------|-------------|
| 项目组件 | `_ComponentName` | `@components/ComponentName` |
| 远程加载器 | `remoteLoader` | `@kne/remote-loader` |
| Ant Design | `antd` | `antd` |
| 仅样式 | 可省略 | `@kne/xxx/dist/index.css` |

`scope` 项可额外包含 `importStatement`，写入 README 时以 `[import ...]` 形式保留。

### 整包引用

在 `example.json` 根节点设置 `reference`，以引用包的 `README.md` 作为文档主体，本地 `list` 中的示例会**追加**到引用包示例列表末尾。适用于封装层只需补充少量扩展示例的场景。

```json
{
  "reference": "@kne/table-page",
  "list": [
    {
      "title": "Features 权限控制",
      "description": "本地扩展示例",
      "code": "./features.js",
      "scope": [{ "name": "_TablePage", "packageName": "@components/TablePage" }]
    }
  ]
}
```

### 单项引用

在 `list` 条目中同时使用 `reference` 与 `path`，从引用包按路径取一条示例，与本地示例混排。

```json
{
  "list": [
    {
      "reference": "@kne/react-file",
      "path": "list[0]"
    },
    {
      "reference": "@kne/react-file",
      "path": "list[2]",
      "title": "文件下载",
      "description": "覆盖引用示例的标题与说明"
    },
    {
      "title": "本地独有示例",
      "code": "./custom.js",
      "scope": []
    }
  ]
}
```

**引用解析规则：**

1. 从 `baseDir` 向上遍历目录，在 `node_modules` 中定位引用包
2. 优先读取引用包 `doc/example.json`；若不存在（如已发布的 npm 包），则解析其 `README.md`
3. 用 `path` 取值，支持 `list[0]`、`list.0` 等写法
4. 若引用示例的 `code` 为 `./xxx.js` 且引用包本地存在对应文件，自动加载代码内容
5. 条目中除 `reference`、`path` 外的字段（如 `title`、`description`）会覆盖引用结果

## parse 反向解析

`parse` 读取符合约定结构的 README.md，提取：

- `name`：H1 标题
- `summary`：「### 概述」与「### 示例」之间的 HTML
- `api`：「### API」之后的 HTML
- `example`：示例元数据，含 `isFull`、`className`、`style`、`list`

示例代码中的反引号在 stringify 时会转义为 `&#96;`，parse 时会还原，保证模板字符串等内容往返不丢失。

## CLI 使用

```shell
# 在当前目录生成 README.md
npx create-md

# 监听 doc/ 与 package.json 变更后自动重新生成
npx create-md --watch
```

## 编程式调用

```javascript
const { stringify, parse } = require('@kne/md-doc');

// 生成 README 并写入文件
await stringify({ baseDir: process.cwd(), output: true });

// 仅返回数据，不写文件
const { readme, data } = await stringify({ baseDir: './my-component', output: false });

// 解析已有 README
const parsed = parse(readmeContent);
```


### 示例

### API

### stringify

根据目录地址读取 `doc/` 源文件，生成 `README.md` 或返回结构化数据。

#### 参数

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| baseDir | 需要解析的包根目录 | string | `process.cwd()` |
| output | 是否写入 `baseDir/README.md` | boolean | `true` |
| name | 自定义组件名称（覆盖 package.json 中的 name 末段） | string | 从 `package.json` 读取 |

#### 返回值

`output` 为 `true` 时，将 README 写入磁盘，同时仍返回下方对象。

| 属性名 | 说明 | 类型 |
|--------|------|------|
| readme | 生成的 README.md 完整文本 | string |
| data | 结构化文档数据 | DataOptions |

#### DataOptions

| 属性名 | 说明 | 类型 |
|--------|------|------|
| name | 组件名称 | string |
| description | 包描述（来自 package.json） | string |
| summary | 概述内容（HTML） | string |
| example | 示例数据，含 `isFull`、`className`、`style`、`list` | object |
| api | API 文档（HTML） | string |

#### 处理优先级

1. 解析 `example.list` 中每条 `reference` + `path` 单项引用
2. 加载本地 `code` 文件内容
3. 若 `example.reference` 存在，使用引用包 README 并追加本地 `list`，**不再**走本地模板生成
4. 否则按 `summary.md`、`api.md`、`example.json` 等本地文件合成 README

---

### parse

将符合约定结构的 README.md 文本解析为结构化对象。

#### 参数

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| text | README.md 文件内容 | string | - |

传入空字符串、`null` 或 `undefined` 时返回 `{ name: '', summary: '', api: '', example: { list: [] } }`。

#### 返回值

| 属性名 | 说明 | 类型 |
|--------|------|------|
| name | H1 标题 | string |
| summary | 「概述」章节 HTML | string |
| api | 「API」章节 HTML | string |
| example | 示例对象 | object |

#### example 对象

| 属性名 | 说明 | 类型 |
|--------|------|------|
| isFull | 是否为全屏示例（识别「### 示例(全屏)」） | boolean |
| className | 由示例样式生成的类名 | string |
| style | 编译后的 CSS | string |
| list | 示例列表 | array |

#### list 数组项

| 属性名 | 说明 | 类型 |
|--------|------|------|
| title | 示例标题（已去除 `(全屏)` 后缀） | string |
| description | 示例说明 | string |
| scope | 依赖范围 | array |
| code | 示例代码 | string |
| isFull | 单条示例是否全屏 | boolean |

#### scope 数组项

| 属性名 | 说明 | 类型 |
|--------|------|------|
| name | 导入变量名 | string |
| packageName | npm 包名或资源路径 | string |
| importStatement | 可选，完整 import 语句 | string |

README 中 scope 行格式：`_Button(@components/Button)[import ...],antd(antd)`

---

### styleTransform

将 SCSS/CSS 样式字符串编译为独立类名与 CSS，用于示例样式隔离。

#### 参数

| 参数名 | 说明 | 类型 |
|--------|------|------|
| name | 组件名称，参与生成 className | string |
| styleString | 样式字符串（支持 SCSS 嵌套） | string |

#### 返回值

| 属性名 | 说明 | 类型 |
|--------|------|------|
| className | 唯一类名，格式 `{name}_{md5前5位}` | string |
| style | 编译后的 CSS；未安装 `sass` 或编译失败时为空字符串 | string |

#### 注意

- 组件名中的 `@`、`/`、`-` 会替换为 `_`
- 需要安装 `sass` 才能编译 SCSS；未安装时仅返回 `className`

---

### resolvePath

按路径表达式从对象中取值，用于解析 `example.json` 中的 `path` 字段。

#### 参数

| 参数名 | 说明 | 类型 |
|--------|------|------|
| obj | 源对象 | object |
| pathStr | 路径表达式，如 `list[0]`、`list.1` | string |

#### 返回值

匹配到的值；路径不存在时返回 `undefined`。

---

### loadReferencedExample

从引用包加载单条示例。

#### 参数

| 参数名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| reference | npm 包名，如 `@kne/react-file` | string | - |
| pathStr | 在引用包示例数据中的路径 | string | - |
| baseDir | 模块解析起点，向上遍历查找 node_modules | string | `process.cwd()` |

#### 返回值

解析成功时返回示例对象（含 `title`、`description`、`code`、`scope` 等）；失败时返回 `null` 并输出警告。

#### 数据来源

1. 引用包存在 `doc/example.json` 时，直接读取 JSON
2. 否则解析引用包 `README.md`，从 `parse` 结果的 `example` 中取数
3. 若 `code` 为 `./xxx.js` 且引用包内存在对应文件，读取文件内容替换 `code`

---

### resolveExampleListReferences

批量解析 `example.list` 中含 `reference` + `path` 的条目，**原地修改**数组。

#### 参数

| 参数名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| exampleList | 示例列表 | array | - |
| baseDir | 传递给 `loadReferencedExample` 的解析起点 | string | `process.cwd()` |

#### 返回值

`Promise<void>`。解析失败的条目保持原样。

#### 合并规则

```javascript
// 解析前
{ reference: '@kne/react-file', path: 'list[0]', title: '自定义标题' }

// 解析后
{ title: '自定义标题', description: '...', code: '...', scope: [...] }
```

本地字段覆盖引用包同名字段；`reference` 与 `path` 不会保留在结果中。

---

### mergeAppendExamplesIntoReadme

将本地示例列表追加到引用包 README 的「示例代码」区块末尾，用于整包引用场景。

#### 参数

| 参数名 | 说明 | 类型 |
|--------|------|------|
| readme | 引用包 README 文本 | string |
| appendList | 待追加的示例列表（`code` 需为已展开的字符串） | array |

#### 返回值

合并后的 README 文本。`appendList` 为空时原样返回 `readme`。

若 README 中无「#### 示例代码」区块，则在「### API」之前插入新区块。

---

### buildExampleCodeSection

将示例列表渲染为 README 中的「#### 示例代码」Markdown 片段。

#### 参数

| 参数名 | 说明 | 类型 |
|--------|------|------|
| exampleList | 示例数组，每项需含 `title`、`description`、`code`、`scope` | array |

#### 返回值

Markdown 字符串；`exampleList` 为空时返回空字符串。

每条示例格式：

```markdown
- 示例标题(全屏)
- 示例说明
- _Button(@components/Button),antd(antd)

```jsx
// 示例代码
```
```

代码块内的反引号会转义为 `&#96;`，避免破坏 Markdown 结构。

---

### create-md（CLI）

| 命令 | 说明 |
|------|------|
| `create-md` | 在 `process.cwd()` 执行 `stringify()` |
| `create-md --watch` | 监听 `doc/` 与 `package.json`，变更时自动重新生成 |

---

### README 章节约定

`parse` 与 `stringify` 依赖以下固定标题（需完全一致）：

| 标题 | 级别 | 用途 |
|------|------|------|
| 描述 | h3 | 包描述（stringify 从 package.json 写入） |
| 安装 | h3 | npm 安装命令 |
| 概述 | h3 | 对应 `doc/summary.md` |
| 示例 / 示例(全屏) | h3 | 示例区域 |
| 示例样式 | h4 | `doc/style.scss` 内容 |
| 示例代码 | h4 | `example.json` 中的 list |
| API | h3 | 对应 `doc/api.md` |
