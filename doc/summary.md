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
