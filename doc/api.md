#### Fetch

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|url|需要请求接口的url|string|- |
|data|POST请求的data|obj| - |
|options|请求的其他参数，如method,headers等，详细请参考[axios](https://github.com/axios/axios)| - |
|loading|在请求发出后没有返回结果时渲染的组件|jsx|null|
|error|请求返回后code不为200时渲染的组件，如果传入函数，参数中会接收到请求返回的错误msg|jsx&#124;func|null|
|empty|请求未发出时渲染的组件|jsx|null|
|auto|是否自动发送请求，如果为false需要手动调用refresh方法才会发送请求，并且url,data,options发生变化后不会自动发送新的请求|bool|true|
|component|请求返回成功时需要渲染的组件|React Component|-|
|render|请求返回成功时执行的方法，改方法需要返回jsx，参数可以拿到{data,refresh,setData}，当存在component时改方法不会被执行|func|-|

#### FetchAll

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|fetchers|需要请求的请求数组，数组中的每一项包含url,data,options,参考Fetch的url,data,options参数|array| - |
|loading|在请求发出后没有返回结果时渲染的组件|jsx|null|
|error|请求返回后code不为200时渲染的组件，如果传入函数，参数中会接收到请求返回的错误msg|jsx&#124;func|null|
|empty|请求未发出时渲染的组件|jsx|null|
|auto|是否自动发送请求，如果为false需要手动调用refresh方法才会发送请求，并且url,data,options发生变化后不会自动发送新的请求|bool|true|
|component|请求返回成功时需要渲染的组件|React Component|-|
|render|请求返回成功时执行的方法，改方法需要返回jsx，参数可以拿到{data,refresh,setData}，当存在component时改方法不会被执行|func|-|

#### withFetch

高阶组件 Fetch组件的封装 withFetch(WrappedComponent) WrappedComponent为一个React Component,等价于给Fetch传入component参数

#### withFetchAll

高阶组件 FetchAll组件的封装 withFetchAll(WrappedComponent) WrappedComponent为一个React Component,等价于给FetchAll传入component参数

#### createWithFetch

withFetch的高阶函数，可以将部分参数提前传入，不必在调用withFetch(WrappedComponent) 时再传入参数

#### createWithFetchAll

withFetchAll的高阶函数，可以将部分参数提前传入，不必在调用withFetchAll(WrappedComponent) 时再传入参数

#### useFetch

React Hooks

参数 useFetch(options)

options:

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|url|需要请求接口的url|string|- |
|data|POST请求的data|obj| - |
|options|请求的其他参数，如method,headers等，详细请参考[axios](https://github.com/axios/axios)｜obj| - |
|auto|是否自动发送请求，如果为false需要手动调用refresh方法才会发送请求，并且url,data,options发生变化后不会自动发送新的请求|bool|true|

返回值 {isLoading, isComplete, errorMsg, results, refresh,setData}

|属性名|说明|类型|
| --- | --- | --- |
|isLoading|当前fetch组件是否正在加载|bool|
|isComplete|当前fetch组件是否已完成|bool|
|errorMsg|当前组件的请求错误信息|bool|
|results|当前组件的请求返回数据|-|
|refresh|可以调用它手动重新发送请求的方法|func|
|setData|可以调用它给fetch中保存值的state赋值|func|

#### useFetchAll

React Hooks

参数 useFetchAll(options)

options:

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|fetchers|需要请求的请求数组，数组中的每一项包含url,data,options,参考Fetch的url,data,options参数|array| - |
|auto|是否自动发送请求，如果为false需要手动调用refresh方法才会发送请求，并且url,data,options发生变化后不会自动发送新的请求|bool|true|

返回值 {isLoading, isComplete, errorMsg, results, refresh,setData}

|属性名|说明|类型|
| --- | --- | --- |
|isLoading|当前fetch组件是否正在加载|bool|
|isComplete|当前fetch组件是否已完成|bool|
|errorMsg|当前组件的请求错误信息|bool|
|results|当前组件的请求返回数据|-|
|refresh|可以调用它手动重新发送请求的方法|func|
|setData|可以调用它给fetch中保存值的state赋值|func|

#### preset 预制设置的方法 preset(options)

options

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|ajax|axios实例|obj|-|
|loading|在请求发出后没有返回结果时渲染的组件|jsx|null|
|error|请求返回后code不为200时渲染的组件，如果传入函数，参数中会接收到请求返回的错误msg|jsx&#124;func|null|
|empty|请求未发出时渲染的组件|jsx|null|
|transformResponse|请求转换器，参数为response返回值为response需要在此方法将请求返回结果转换成规定的格式|func|-|

#### 缓存接口的应用

Fetch options

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |
|cache|1、cache为bool类型，例如：<br>cache: true则启用内存内存缓存；<br>2、cache为对象类型，例如<br>cache:{<br>&nbsp;&nbsp;expire: 1000 * 60 * 5, // 过期时间  默认5分钟; 0:表示不过期 <br>&nbsp;&nbsp;storage: false, // 是否开启本地缓存<br>&nbsp;&nbsp;storage_expire: 1000 * 60 * 5, // 本地缓存过期时间  默认5分钟; 0:表示不过期<br>&nbsp;&nbsp; max_cache_size: 15<br>}|bool,object|-|
