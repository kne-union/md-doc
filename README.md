
# md-doc


### 描述

转换readme.md文件


### 安装

```shell
npm i --save @kne/md-doc
```


### 概述

格式化或解析文件数据

### stringify

根据目录地址编译并格式化数据，返回数据或将数据导出为 README.md 文件

1. 获取目录地址
2. 根据目录地址读取并重新赋值目录下固定文件的数据
3. 取解析后的 ”example.list“ 数据循环，获取每条数据中的 ”code“ 字段，读取 ”code“ 后的文件数据重新赋值给 code
4. 获取文件名称（自定义的或者 package name）
5. 格式化以上获取到的数据生成新的 readme 数据
6. 根据传入或默认的 output 状态返回以下数据

output：

* 解析目录下文件后重新生成的 README.md 文件

或者：

* 解析目录下文件后重新生成的 readme 文件数据
* 解析路径文件格式化后的数据
* 数据包括
    - name ***（传入的）组件 name 或 package 的 name***
    - description ***根据路径解析出的 example.json 数据中 list 格式化***
    - summary ***根据路径解析出的 summary.md 数据***
    - example ***根据路径解析出并格式化的 example.json 数据***
    - api ***根据路径解析出的 api.md 数据***

### parse

接收读取到的 README.md 文件数据，返回一个格式化后的 Object

Output:

* name ***解析出的标题***
* summary ***解析出的概述***
* api ***解析出的 API***
* example ***读取到的 example 是一个 jsx 模块，会将拿到的数据进行反解析***

example 模块：
例如：

```jsx
const {default: [name]} = _[name];
const {Button} = _antd;
const {createWithRemoteLoader} = _remoteLoader;

const BaseExample = createWithRemoteLoader({
  modules: ['Modal@useModal']
})(({remoteModules}) => {
  const [useModal] = remoteModules;
  const modal = useModal();
  return (
    <Button
      onClick={() => {
        modal({
          title: '',
          footer: null,
          size: 'small',
          children: <div>BaseExample</div>,
        });
      }}
    >
      点击弹出
    </Button>
  );
});

render(<BaseExample/>);
```

会被解析为如下示例：

```json
{
  "isFull": false,
  "className": "[name]_55026",
  "style": "",
  "list": [
    {
      "title": "这里填写示例标题",
      "description": "这里填写示例说明",
      "scope": [
        {
          "name": "_[name]",
          "packageName": "@components/[name]"
        },
        {
          "name": "_remoteLoader",
          "packageName": "@kne/remote-loader"
        },
        {
          "name": "_antd",
          "packageName": "antd"
        }
      ],
      "code": ["解析后其实是上述 jsx 模块的 string 版本"]
    }
  ]
}
```


### 示例

#### 示例代码



### API

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

