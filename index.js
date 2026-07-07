const fs = require('fs-extra');
const path = require('node:path');
const Markdown = require('markdown-it');
const { unescape } = require('html-escaper');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');

// 常量定义
const DEFAULT_BASE_DIR = process.cwd();
const DOC_FILES = [
  { dir: './doc/api.md', name: 'api' },
  { dir: './doc/summary.md', name: 'summary' },
  { dir: './doc/example.json', name: 'example' },
  { dir: './doc/style.css', name: 'style' },
  { dir: './doc/style.scss', name: 'style' },
  { dir: './package.json', name: 'package' }
];

const MD_TITLES = {
  SUMMARY: '概述',
  EXAMPLE: '示例',
  EXAMPLE_FULL: '示例(全屏)',
  API: 'API',
  EXAMPLE_STYLE: '示例样式',
  EXAMPLE_CODE: '示例代码'
};

const ITEM_FULL_SUFFIX = '(全屏)';

// 初始化 jQuery
const { document } = (new JSDOM()).window;
global.document = document;
const $ = require('jquery')(document.defaultView);

// 缓存 sass 模块
let sassModule = null;

const getSassModule = () => {
  if (sassModule !== null) {
    return sassModule;
  }
  try {
    sassModule = require('sass');
    return sassModule;
  } catch (e) {
    console.warn('sass没有安装,请安装sass用以编译sass文件(node-sass已不再被支持)');
    sassModule = false;
    return false;
  }
};

// 工具函数
const get = (obj, path, defaultValue = undefined) => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null) {
      return defaultValue;
    }
    result = result[key];
  }
  return result !== undefined ? result : defaultValue;
};

const last = (arr) => {
  return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
};

// 样式 ID 缓存
const styleIdCache = new Map();

const generateStyleId = (name) => {
  if (styleIdCache.has(name)) {
    return styleIdCache.get(name);
  }
  const styleId = name.replace(/[@\/\-]/g, '_') + '_' + crypto.createHash('md5').update(name).digest('hex').slice(0, 5);
  styleIdCache.set(name, styleId);
  return styleId;
};

const styleTransform = (name, styleString) => {
  const output = { className: '', style: '' };
  
  if (!styleString || typeof styleString !== 'string') {
    return output;
  }
  
  const styleId = generateStyleId(name);
  output.className = styleId;
  
  const sass = getSassModule();
  if (!sass) {
    return output;
  }
  
  try {
    const result = sass.compileString(`.${styleId}{${unescape(styleString)}}`);
    output.style = result.css;
  } catch (error) {
    console.warn('样式编译失败:', error.message);
  }
  
  return output;
};

// 读取文档文件
const readDocFiles = async (baseDir) => {
  const data = {};
  
  await Promise.all(DOC_FILES.map(async ({ dir, name }) => {
    const file = path.resolve(baseDir, dir);
    try {
      if (await fs.exists(file)) {
        if (/\.json$/.test(dir)) {
          data[name] = await fs.readJson(file);
        } else {
          data[name] = await fs.readFile(file, 'utf8');
        }
      }
    } catch (error) {
      console.warn(`读取文件失败: ${file}`, error.message);
    }
  }));
  
  return data;
};

// 解析路径表达式，支持 list[0]、list.0 等写法
const resolvePath = (obj, pathStr) => {
  if (!pathStr || obj == null) {
    return undefined;
  }

  const normalized = pathStr
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\./, '');
  const keys = normalized.split('.').filter(Boolean);
  let result = obj;

  for (const key of keys) {
    if (result == null) {
      return undefined;
    }
    result = result[key];
  }

  return result;
};

// 收集模块解析路径，从 baseDir 向上遍历目录
const getResolvePaths = (baseDir) => {
  const paths = [];
  let current = path.resolve(baseDir);
  const root = path.parse(current).root;

  while (current !== root) {
    paths.push(current);
    current = path.dirname(current);
  }

  return paths;
};

// 将引用包 README 中的 current-lib 占位符还原为真实包名
const normalizeCurrentLibPlaceholder = (value, packageName) => {
  if (!value || typeof value !== 'string' || !packageName) {
    return value;
  }
  const placeholder = packageName.split('/').join('/current-lib_');
  return value.split(placeholder).join(packageName);
};

const normalizeReferencedExample = (item, packageName) => {
  const normalized = { ...item };

  if (Array.isArray(normalized.scope)) {
    normalized.scope = normalized.scope.map((scopeItem) => ({
      ...scopeItem,
      packageName: normalizeCurrentLibPlaceholder(scopeItem.packageName, packageName)
    }));
  }

  return normalized;
};

// 从引用包加载单个示例项
const loadReferencedExample = async (reference, pathStr, baseDir = DEFAULT_BASE_DIR) => {
  try {
    const resolvePaths = getResolvePaths(baseDir);
    const packageJsonPath = require.resolve(`${reference}/package.json`, { paths: resolvePaths });
    const packageDir = path.dirname(packageJsonPath);
    const { name: packageName } = require(packageJsonPath);
    const exampleJsonPath = path.join(packageDir, 'doc/example.json');
    let exampleData;

    if (await fs.exists(exampleJsonPath)) {
      exampleData = await fs.readJson(exampleJsonPath);
    } else {
      const readmePath = require.resolve(`${reference}/README.md`, { paths: resolvePaths });
      const readme = await fs.readFile(readmePath, 'utf8');
      exampleData = parse(readme).example || {};
    }

    const item = resolvePath(exampleData, pathStr);

    if (!item || typeof item !== 'object') {
      console.warn(`引用路径未找到: ${reference} -> ${pathStr}`);
      return null;
    }

    const resolved = normalizeReferencedExample({ ...item }, packageName);

    if (resolved.code && typeof resolved.code === 'string' && /^\.\//.test(resolved.code)) {
      const codePath = path.resolve(packageDir, 'doc', resolved.code);
      if (await fs.exists(codePath)) {
        resolved.code = await fs.readFile(codePath, 'utf8');
      }
    }

    return resolved;
  } catch (error) {
    console.warn(`加载引用示例失败: ${reference} -> ${pathStr}`, error.message);
    return null;
  }
};

// 解析 list 中的 reference + path 引用项
const resolveExampleListReferences = async (exampleList, baseDir = DEFAULT_BASE_DIR) => {
  if (!Array.isArray(exampleList) || exampleList.length === 0) {
    return;
  }

  await Promise.all(exampleList.map(async (item, index) => {
    if (!item || !item.reference || !item.path) {
      return;
    }

    const resolved = await loadReferencedExample(item.reference, item.path, baseDir);
    if (!resolved) {
      return;
    }

    const { reference, path: refPath, ...localOverrides } = item;
    exampleList[index] = { ...resolved, ...localOverrides };
  }));
};

// 加载示例代码
const loadExampleCodes = async (baseDir, exampleList) => {
  if (!Array.isArray(exampleList) || exampleList.length === 0) {
    return;
  }
  
  await Promise.all(exampleList.map(async (item) => {
    if (!item.code) return;
    
    const codeFileDir = path.resolve(baseDir, './doc', item.code);
    try {
      if (await fs.exists(codeFileDir)) {
        item.code = await fs.readFile(codeFileDir, 'utf8');
      }
    } catch (error) {
      console.warn(`读取示例代码失败: ${codeFileDir}`, error.message);
    }
  }));
};

// 处理参考文档，支持将本地 example.list 追加到引用包的示例列表
const handleReference = async (baseDir, example, output, { appendList = [] } = {}) => {
  if (!example || !example.reference) {
    return null;
  }
  
  try {
    let readme = await fs.readFile(require.resolve(`${example.reference}/README.md`), 'utf8');
    const { name } = require(`${example.reference}/package.json`);
    readme = readme.replace(new RegExp(name.split('/').join('/current-lib_'), 'g'), name);

    if (appendList.length > 0) {
      readme = mergeAppendExamplesIntoReadme(readme, appendList);
    }
    
    if (output) {
      await fs.writeFile(path.resolve(baseDir, './README.md'), readme);
    }
    
    return { readme, data: parse(readme) };
  } catch (error) {
    console.error('处理参考文档失败:', error.message);
    return null;
  }
};

// 格式化输出数据
const formatOutputData = (data, options) => {
  const md = new Markdown();
  const name = options.name || last(get(data, 'package.name', '').split('/')) || '';
  
  return {
    name,
    packageName: get(data, 'package.name', ''),
    description: get(data, 'package.description', ''),
    summary: data.summary || '',
    summaryMD: md.render(data.summary || ''),
    style: (data.style || '').trim(),
    styleObject: styleTransform(name, data.style),
    example: data.example || {},
    api: data.api || '',
    apiMd: md.render(data.api || '')
  };
};

const escapeTemplateString = (value) =>
  (value || '')
    .toString()
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');

const buildReadmeConfigImports = (exampleList = []) => {
  const importList = [];
  const mapping = {};
  let componentIndex = 0;

  exampleList.forEach(({ scope }) => {
    (scope || []).forEach(({ name, packageName }) => {
      if (!packageName || mapping[packageName]) {
        return;
      }
      const key = `component_${++componentIndex}`;
      importList.push(name ? `import * as ${key} from '${packageName}';` : `import '${packageName}';`);
      if (name) {
        mapping[packageName] = key;
      }
    });
  });

  return { importList, mapping };
};

/**
 * 将 parse/stringify 的结构化文档转为 modules-dev 示例页使用的 readmeConfig 模块源码。
 * 须保留 example.list[].isFull，供 @kne/example-driver 单条示例全宽展示。
 */
const generateReadmeConfig = (readme) => {
  const exampleList = get(readme, 'example.list', []) || [];

  const { importList, mapping } = buildReadmeConfigImports(exampleList);

  const listItems = exampleList
    .map((item) => {
      const scopeItems = (item.scope || [])
        .filter(({ name }) => !!name)
        .map(({ name, importStatement, packageName }) => {
          return `{
    name: "${name}",
    packageName: "${packageName}",${importStatement ? `
    importStatement: "${importStatement.replace(/"/g, '\\"')}",` : ''}
    component: ${mapping[packageName]}
}`;
        })
        .join(',');

      return `{
    title: \`${item.title}\`,
    description: \`${item.description}\`,${item.isFull === true ? `
    isFull: true,` : ''}
    code: \`${escapeTemplateString(item.code)}\`,
    scope: [${scopeItems}]
}`;
    })
    .join(',');

  return `${importList.join('\n')}
const readmeConfig = {
    name: \`${readme.name || ''}\`,
    summary: \`${readme.summary}\`,
    ${readme.description ? `description: \`${readme.description}\`,` : ''}
    ${readme.packageName ? `packageName: \`${readme.packageName}\`,` : ''}
    api: \`${readme.api}\`,
    example: {
        isFull: ${get(readme, 'example.isFull') === true},
        className: \`${get(readme, 'example.className') || ''}\`,
        style: \`${get(readme, 'example.style') || ''}\`,
        list: [${listItems}]
    }
};
export default readmeConfig;
`;
};

// 转义代码块中的反引号
const escapeCodeBlock = (code) => {
  if (!code) return code;
  // 将代码中的反引号转义为 HTML 实体
  return code.replace(/`/g, '&#96;');
};

const buildExampleItemMarkdown = ({ title, description, code, scope, isFull }) => {
  const scopeStr = (scope || []).map(({ name, importStatement, packageName }) => {
    return `${name || ''}(${packageName})${importStatement ? `[${importStatement}]` : ''}`;
  }).join(',');
  return `- ${title}${isFull ? ITEM_FULL_SUFFIX : ''}\n- ${description}\n- ${scopeStr}\n\n\`\`\`jsx\n${escapeCodeBlock(code)}\n\`\`\``;
};

const buildExampleCodeSection = (exampleList) => {
  if (!Array.isArray(exampleList) || exampleList.length === 0) {
    return '';
  }
  return `#### ${MD_TITLES.EXAMPLE_CODE}\n\n${exampleList.map(buildExampleItemMarkdown).join('\n\n')}`;
};

// 将本地追加的示例合并进 reference README
const mergeAppendExamplesIntoReadme = (readme, appendList) => {
  if (!readme || typeof readme !== 'string' || !Array.isArray(appendList) || appendList.length === 0) {
    return readme;
  }

  const parsed = parse(readme);
  const mergedList = [...(parsed.example.list || []), ...appendList];
  const newExampleSection = buildExampleCodeSection(mergedList);
  const codeSectionStart = readme.indexOf(`#### ${MD_TITLES.EXAMPLE_CODE}`);
  const apiSectionStart = readme.indexOf(`### ${MD_TITLES.API}`);

  if (codeSectionStart !== -1 && apiSectionStart !== -1 && apiSectionStart > codeSectionStart) {
    const before = readme.slice(0, codeSectionStart);
    const after = readme.slice(apiSectionStart);
    return `${before}${newExampleSection}\n\n${after}`;
  }

  if (apiSectionStart !== -1) {
    const before = readme.slice(0, apiSectionStart).trimEnd();
    const after = readme.slice(apiSectionStart);
    return `${before}\n\n${newExampleSection}\n\n${after}`;
  }

  return `${readme.trimEnd()}\n\n${newExampleSection}`;
};

// 反转义代码块中的 HTML 实体
const unescapeCodeBlock = (code) => {
  if (!code) return code;
  return unescape(code).replace(/&#96;/g, '`');
};

// 生成 README 内容
const generateReadme = (outputData) => {
  const {
    name,
    packageName,
    description,
    summary,
    style,
    example
  } = outputData;
  
  const hasDescription = description && description.trim();
  const hasPackageName = packageName && packageName.trim();
  const hasSummary = summary && summary.trim();
  const isFull = get(example, 'isFull') === true;
  const hasStyle = style && style.trim();
  const exampleList = get(example, 'list', []);
  const hasExamples = Array.isArray(exampleList) && exampleList.length > 0;
  
  let content = `# ${name}\n\n`;
  
  if (hasDescription) {
    content += `### 描述\n\n${description}\n\n`;
  }
  
  if (hasPackageName) {
    content += `### 安装\n\n\`\`\`shell\nnpm i --save ${packageName}\n\`\`\`\n\n`;
  }
  
  if (hasSummary) {
    content += `### 概述\n\n${summary}\n\n`;
  }
  
  content += `### 示例${isFull ? '(全屏)' : ''}\n\n`;
  
  if (hasStyle) {
    content += `#### 示例样式\n\n\`\`\`scss\n${style}\n\`\`\`\n\n`;
  }
  
  if (hasExamples) {
    content += `${buildExampleCodeSection(exampleList)}\n\n`;
  }
  
  content += `### API\n\n${outputData.api}`;
  
  return content;
};

const stringify = async (options = {}) => {
  const opts = Object.assign({ baseDir: DEFAULT_BASE_DIR, output: true }, options);
  
  // 读取文档文件
  const data = await readDocFiles(opts.baseDir);
  
  const appendList = get(data, 'example.list', []) || [];

  // 解析 list 中的 reference + path 引用
  await resolveExampleListReferences(appendList, opts.baseDir);

  // 加载本地示例代码
  await loadExampleCodes(opts.baseDir, appendList);
  
  // 处理参考文档（可将本地 example.list 追加到引用包示例后）
  const referenceResult = await handleReference(opts.baseDir, data.example, opts.output, { appendList });
  if (referenceResult) {
    return referenceResult;
  }
  
  // 格式化输出数据
  const outputData = formatOutputData(data, opts);
  
  // 生成 README
  const readme = generateReadme(outputData);
  
  // 写入文件或返回数据
  if (opts.output) {
    try {
      await fs.writeFile(path.resolve(opts.baseDir, './README.md'), readme);
    } catch (error) {
      console.error('写入 README.md 失败:', error.message);
      throw error;
    }
  }
  
  return {
    readme,
    data: {
      name: outputData.name,
      description: outputData.description,
      summary: outputData.summaryMD,
      example: Object.assign({}, data.example, outputData.styleObject),
      api: outputData.apiMd
    }
  };
};

// 解析 scope 字符串
const parseScopeString = (scopeStr) => {
  if (!scopeStr || typeof scopeStr !== 'string') {
    return [];
  }
  
  return scopeStr.split(',').map((str) => {
    const matcher = str.match(/(.*)\((.*)\)/);
    const importStatementMatcher = str.match(/\[(.*)]/);
    const output = {};
    
    if (matcher) {
      output.name = matcher[1];
      output.packageName = matcher[2];
    }
    
    if (importStatementMatcher) {
      output.importStatement = importStatementMatcher[1];
    }
    
    return Object.keys(output).length > 0 ? output : null;
  }).filter(Boolean);
};

// 解析示例属性
const parseExampleProps = ($domList, exampleIndex, apiTitleIndex) => {
  const props = [];
  $domList.each((index, item) => {
    if (index > exampleIndex && index < apiTitleIndex && $(item).is('ul')) {
      const output = [];
      $(item).find('li').each((i, li) => {
        output.push($(li).text());
      });
      
      const rawTitle = output[0] || '';
      const isFull = rawTitle.endsWith(ITEM_FULL_SUFFIX);
      const title = isFull ? rawTitle.slice(0, -ITEM_FULL_SUFFIX.length) : rawTitle;

      props.push({
        title,
        description: output[1] || '',
        scope: parseScopeString(output[2]),
        ...(isFull ? { isFull: true } : {})
      });
    }
  });
  return props;
};

// 解析示例代码
const parseExampleCodes = ($domList, exampleIndex, apiTitleIndex) => {
  const codes = [];
  $domList.each((index, item) => {
    if (index > exampleIndex && index < apiTitleIndex && $(item).is('pre')) {
      const code = unescape($(item).find('code').html() || '');
      codes.push(unescapeCodeBlock(code));
    }
  });
  return codes;
};

// 查找标题索引
const findTitleIndex = ($domList, tagName, text) => {
  for (let i = 0; i < $domList.length; i++) {
    const $el = $($domList[i]);
    if ($el.is(tagName) && $el.text() === text) {
      return i;
    }
  }
  return -1;
};

// 解析 Markdown 文本
const parse = (text) => {
  if (!text || typeof text !== 'string') {
    return { name: '', summary: '', api: '', example: { list: [] } };
  }
  
  const data = {};
  const md = new Markdown();
  const $dom = $(`<div>${md.render(text)}</div>`);
  const $domList = $dom.children();
  
  // 解析组件名称
  const $h1 = $domList.filter('h1');
  data.name = $h1.length > 0 ? $h1.first().text().trim() : '';
  
  // 查找各部分标题索引
  const summaryTitleIndex = findTitleIndex($domList, 'h3', MD_TITLES.SUMMARY);
  const exampleTitleIndex = findTitleIndex($domList, 'h3', MD_TITLES.EXAMPLE) >= 0 
    ? findTitleIndex($domList, 'h3', MD_TITLES.EXAMPLE)
    : findTitleIndex($domList, 'h3', MD_TITLES.EXAMPLE_FULL);
  const apiTitleIndex = findTitleIndex($domList, 'h3', MD_TITLES.API);
  
  // 解析概述内容
  if (summaryTitleIndex >= 0 && exampleTitleIndex >= 0) {
    data.summary = $domList.slice(summaryTitleIndex + 1, exampleTitleIndex).map((_, el) => el.outerHTML).get().join('\n');
  } else {
    data.summary = '';
  }
  
  // 解析 API 内容
  if (apiTitleIndex >= 0) {
    data.api = $domList.slice(apiTitleIndex + 1).map((_, el) => el.outerHTML).get().join('\n');
  } else {
    data.api = '';
  }
  
  // 解析示例信息
  data.example = {};
  data.example.isFull = findTitleIndex($domList, 'h3', MD_TITLES.EXAMPLE_FULL) >= 0;
  
  // 解析样式
  const exampleStyleIndex = findTitleIndex($domList, 'h4', MD_TITLES.EXAMPLE_STYLE);
  if (exampleStyleIndex >= 0 && exampleStyleIndex + 1 < $domList.length) {
    const styleString = $($domList[exampleStyleIndex + 1]).find('code').html();
    const styleObject = styleTransform(data.name, styleString);
    data.example.className = styleObject.className;
    data.example.style = styleObject.style;
  }
  
  // 解析示例代码和属性
  const exampleIndex = findTitleIndex($domList, 'h4', MD_TITLES.EXAMPLE_CODE);
  if (exampleIndex >= 0 && apiTitleIndex >= 0) {
    const exampleCodes = parseExampleCodes($domList, exampleIndex, apiTitleIndex);
    const exampleProps = parseExampleProps($domList, exampleIndex, apiTitleIndex);
    
    data.example.list = exampleCodes.map((code, index) => {
      return Object.assign({}, exampleProps[index], { code });
    });
  } else {
    data.example.list = [];
  }
  
  return data;
};

module.exports = {
  stringify,
  parse,
  styleTransform,
  mergeAppendExamplesIntoReadme,
  buildExampleCodeSection,
  generateReadmeConfig,
  resolvePath,
  resolveExampleListReferences,
  loadReferencedExample,
  normalizeCurrentLibPlaceholder,
  normalizeReferencedExample,
  ITEM_FULL_SUFFIX
};
