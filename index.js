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

// 处理参考文档
const handleReference = async (baseDir, example, output) => {
  if (!example || !example.reference) {
    return null;
  }
  
  try {
    let readme = await fs.readFile(require.resolve(`${example.reference}/README.md`), 'utf8');
    const { name } = require(`${example.reference}/package.json`);
    readme = readme.replace(new RegExp(name.split('/').join('/current-lib_'), 'g'), name);
    
    if (output) {
      console.log('---->', readme);
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

// 转义代码块中的反引号
const escapeCodeBlock = (code) => {
  if (!code) return code;
  // 将代码中的反引号转义为 HTML 实体
  return code.replace(/`/g, '&#96;');
};

// 反转义代码块中的 HTML 实体
const unescapeCodeBlock = (code) => {
  if (!code) return code;
  // 将 HTML 实体转义回反引号
  return code.replace(/&#96;/g, '`');
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
    content += `#### 示例代码\n\n`;
    content += exampleList.map(({ title, description, code, scope }) => {
      const scopeStr = (scope || []).map(({ name, importStatement, packageName }) => {
        return `${name || ''}(${packageName})${importStatement ? `[${importStatement}]` : ''}`;
      }).join(',');
      return `- ${title}\n- ${description}\n- ${scopeStr}\n\n\`\`\`jsx\n${escapeCodeBlock(code)}\n\`\`\``;
    }).join('\n\n');
    content += '\n\n';
  }
  
  content += `### API\n\n${outputData.api}`;
  
  return content;
};

const stringify = async (options = {}) => {
  const opts = Object.assign({ baseDir: DEFAULT_BASE_DIR, output: true }, options);
  
  // 读取文档文件
  const data = await readDocFiles(opts.baseDir);
  
  // 加载示例代码
  await loadExampleCodes(opts.baseDir, get(data, 'example.list'));
  
  // 处理参考文档
  const referenceResult = await handleReference(opts.baseDir, data.example, opts.output);
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
      
      props.push({
        title: output[0] || '',
        description: output[1] || '',
        scope: parseScopeString(output[2])
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

module.exports = { stringify, parse, styleTransform };
