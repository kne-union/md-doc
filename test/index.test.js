const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { stringify, parse, styleTransform } = require('../index');

describe('md-doc', () => {
  let tempDir;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = path.join(os.tmpdir(), 'md-doc-test-' + Date.now());
    await fs.ensureDir(path.join(tempDir, 'doc'));
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.remove(tempDir);
  });

  describe('styleTransform', () => {
    it('应该生成唯一的 className', () => {
      const result1 = styleTransform('test-component', 'color: red;');
      const result2 = styleTransform('test-component', 'color: blue;');

      expect(result1.className).to.be.a('string');
      expect(result1.className).to.equal(result2.className);
      expect(result1.className).to.include('test_component_');
    });

    it('应该编译 SCSS 样式', () => {
      const result = styleTransform('test', '.box { color: red; background: blue; }');

      expect(result.style).to.be.a('string');
      expect(result.style).to.include('.test');
      expect(result.style).to.include('color');
      expect(result.style).to.include('background');
    });

    it('空样式字符串应该返回空 style', () => {
      const result = styleTransform('test', '');

      expect(result.style).to.equal('');
      expect(result.className).to.be.a('string');
    });

    it('null 或 undefined 样式应该返回空', () => {
      const result1 = styleTransform('test', null);
      const result2 = styleTransform('test', undefined);

      expect(result1.style).to.equal('');
      expect(result2.style).to.equal('');
    });

    it('组件名称中的特殊字符应该被替换', () => {
      const result = styleTransform('@test/component-name', 'color: red;');

      expect(result.className).to.not.include('@');
      expect(result.className).to.not.include('/');
      expect(result.className).to.include('_test_component_name_');
    });
  });

  describe('parse', () => {
    it('应该解析组件名称', () => {
      const md = '# My Component\n\nSome content';
      const result = parse(md);

      expect(result.name).to.equal('My Component');
    });

    it('应该解析概述内容', () => {
      const md = `# Test

### 概述

This is a summary paragraph.

Another paragraph.

### 示例`;
      const result = parse(md);

      expect(result.summary).to.include('This is a summary paragraph');
      expect(result.summary).to.include('Another paragraph');
    });

    it('应该解析 API 内容', () => {
      const md = `# Test

### 概述

Summary

### API

### stringify

API content here`;
      const result = parse(md);

      expect(result.api).to.include('API content here');
    });

    it('应该识别全屏示例模式', () => {
      const md = `# Test

### 概述

Summary

### 示例(全屏)

Some content`;
      const result = parse(md);

      expect(result.example.isFull).to.be.true;
    });

    it('应该识别普通示例模式', () => {
      const md = `# Test

### 概述

Summary

### 示例

Some content`;
      const result = parse(md);

      expect(result.example.isFull).to.be.false;
    });

    it('应该解析示例样式', () => {
      const md = `# Test

### 概述

Summary

### 示例

#### 示例样式

\`\`\`scss
color: red;
\`\`\`

#### 示例代码`;
      const result = parse(md);

      expect(result.example.className).to.be.a('string');
      expect(result.example.style).to.include('color');
    });

    it('应该解析示例代码列表', () => {
      const md = `# Test

### 概述

Summary

### 示例

#### 示例代码

- 示例标题
- 示例描述
- scope1(package1), scope2(package2)

\`\`\`jsx
const App = () => <div>Example</div>;
\`\`\`

- 另一个示例
- 另一个描述
- scope3(package3)

\`\`\`jsx
const App2 = () => <div>Example2</div>;
\`\`\`

### API`;
      const result = parse(md);

      expect(result.example.list).to.be.an('array');
      expect(result.example.list).to.have.lengthOf(2);
      expect(result.example.list[0]).to.have.property('title', '示例标题');
      expect(result.example.list[0]).to.have.property('description', '示例描述');
      expect(result.example.list[0]).to.have.property('code');
      expect(result.example.list[0].scope).to.be.an('array');
      expect(result.example.list[0].scope[0]).to.have.property('name', 'scope1');
      expect(result.example.list[0].scope[0]).to.have.property('packageName', 'package1');
    });

    it('应该解析带有 importStatement 的 scope', () => {
      const md = `# Test

### 概述

Summary

### 示例

#### 示例代码

- 标题
- 描述
- Button(antd)[import { Button } from 'antd']

\`\`\`jsx
const Button = () => <button>Click</button>;
<Button>Click</Button>
\`\`\`

### API`;
      const result = parse(md);

      expect(result.example.list[0].scope[0]).to.have.property('name', 'Button');
      expect(result.example.list[0].scope[0]).to.have.property('packageName', 'antd');
      expect(result.example.list[0].scope[0]).to.have.property('importStatement', "import { Button } from 'antd'");
    });

    it('应该正确处理包含字符串模板的代码', async () => {
      // 创建测试文件
      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: '@test/template',
        description: 'Template test',
        version: '1.0.0'
      });

      await fs.writeFile(
        path.join(tempDir, 'doc/summary.md'),
        'Summary'
      );

      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: [
          {
            title: '字符串模板示例',
            description: '测试字符串模板',
            code: 'template.js',
            scope: []
          }
        ]
      });

      // 包含字符串模板的代码
      const templateCode = `const message = \`Hello \${name}\`;
const another = \`simple\`;
const multiline = \`line1
line2
line3\`;`;

      await fs.writeFile(
        path.join(tempDir, 'doc/template.js'),
        templateCode
      );

      // 执行 stringify
      await stringify({ baseDir: tempDir, output: true });

      // 读取生成的 README
      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      // README 应该包含 HTML 实体转义的反引号
      expect(readme).to.include('&#96;Hello ');

      // 执行 parse
      const parsed = parse(readme);

      // 解析后的代码应该正确恢复反引号（去除首尾空白）
      expect(parsed.example.list[0].code.trim()).to.equal(templateCode);
      expect(parsed.example.list[0].code).to.include('`Hello ${name}`');
      expect(parsed.example.list[0].code).to.include('`simple`');
      expect(parsed.example.list[0].code).to.include('`line1');
    });

    it('应该正确处理包含多个反引号的代码', async () => {
      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: '@test/multi-backtick',
        version: '1.0.0'
      });

      await fs.writeFile(path.join(tempDir, 'doc/summary.md'), 'Summary');
      await fs.writeFile(path.join(tempDir, 'doc/api.md'), 'API');

      // 使用单引号字符串
      const codeWithBackticks = [
        'const a = `hello`;',
        'const b = `world`;',
        'const c = `${a} + ${b}`;'
      ].join('\n');

      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: [
          {
            title: '多反引号测试',
            description: '测试',
            code: 'multi.js',
            scope: []
          }
        ]
      });

      await fs.writeFile(path.join(tempDir, 'doc/multi.js'), codeWithBackticks);

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');
      const parsed = parse(readme);

      expect(parsed.example.list[0].code.trim()).to.equal(codeWithBackticks);
    });

    it('应该正确处理空代码和没有反引号的代码', async () => {
      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: '@test/no-backtick',
        version: '1.0.0'
      });

      await fs.writeFile(path.join(tempDir, 'doc/summary.md'), 'Summary');
      await fs.writeFile(path.join(tempDir, 'doc/api.md'), 'API');

      const codeWithoutBackticks = 'const a = 1;\nconst b = 2;';

      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: [
          {
            title: '无反引号测试',
            description: '测试',
            code: 'no-backtick.js',
            scope: []
          }
        ]
      });

      await fs.writeFile(path.join(tempDir, 'doc/no-backtick.js'), codeWithoutBackticks);

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');
      const parsed = parse(readme);

      expect(parsed.example.list[0].code.trim()).to.equal(codeWithoutBackticks);
    });

    it('空字符串应该返回默认值', () => {
      const result = parse('');

      expect(result.name).to.equal('');
      expect(result.summary).to.equal('');
      expect(result.api).to.equal('');
      expect(result.example.list).to.be.an('array');
      expect(result.example.list).to.have.lengthOf(0);
    });

    it('null 或 undefined 应该返回默认值', () => {
      const result1 = parse(null);
      const result2 = parse(undefined);

      expect(result1.name).to.equal('');
      expect(result2.name).to.equal('');
    });

    it('没有找到的标题应该返回空字符串', () => {
      const md = '# Test\n\nSome content';
      const result = parse(md);

      expect(result.summary).to.equal('');
      expect(result.api).to.equal('');
    });
  });

  describe('stringify', () => {
    beforeEach(async () => {
      // 创建 package.json
      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: '@test/component',
        description: 'Test component',
        version: '1.0.0'
      });

      // 创建 summary.md
      await fs.writeFile(
        path.join(tempDir, 'doc/summary.md'),
        'This is the summary content.\n\nMore details here.'
      );

      // 创建 api.md
      await fs.writeFile(
        path.join(tempDir, 'doc/api.md'),
        '### stringify\n\nAPI documentation here.'
      );
    });

    it('应该生成 README.md 文件', async () => {
      await stringify({ baseDir: tempDir, output: true });

      const readmePath = path.join(tempDir, 'README.md');
      const exists = await fs.exists(readmePath);

      expect(exists).to.be.true;

      const readme = await fs.readFile(readmePath, 'utf8');
      expect(readme).to.include('# component');
      expect(readme).to.include('Test component');
      expect(readme).to.include('This is the summary content');
      expect(readme).to.include('### API');
    });

    it('应该包含安装命令', async () => {
      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('npm i --save @test/component');
    });

    it('output 为 false 时应该返回数据而不写文件', async () => {
      const result = await stringify({ baseDir: tempDir, output: false });

      expect(result).to.have.property('readme');
      expect(result).to.have.property('data');
      expect(result.data).to.have.property('name', 'component');
      expect(result.data).to.have.property('summary');
      expect(result.data).to.have.property('api');

      const readmePath = path.join(tempDir, 'README.md');
      const exists = await fs.exists(readmePath);
      expect(exists).to.be.false;
    });

    it('应该使用自定义 name 参数', async () => {
      await stringify({ baseDir: tempDir, output: true, name: 'Custom Name' });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('# Custom Name');
    });

    it('应该读取和渲染示例代码', async () => {
      // 创建 example.json
      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: [
          {
            title: '示例标题',
            description: '示例描述',
            code: 'example-code.js',
            scope: [
              { name: 'Button', packageName: 'antd' }
            ]
          }
        ]
      });

      // 创建示例代码文件
      await fs.writeFile(
        path.join(tempDir, 'doc/example-code.js'),
        '<Button>Click me</Button>'
      );

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('示例标题');
      expect(readme).to.include('示例描述');
      expect(readme).to.include('Button(antd)');
      expect(readme).to.include('Click me');
    });

    it('应该处理示例样式', async () => {
      // 创建 example.json
      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: []
      });

      // 创建 style.scss
      await fs.writeFile(
        path.join(tempDir, 'doc/style.scss'),
        '.test { color: red; }'
      );

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('#### 示例样式');
      expect(readme).to.include('.test { color: red; }');
    });

    it('应该处理全屏示例模式', async () => {
      // 创建 example.json
      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        isFull: true,
        list: []
      });

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('### 示例(全屏)');
    });

    it('应该支持 CSS 和 SCSS 样式文件', async () => {
      await fs.writeFile(
        path.join(tempDir, 'doc/style.css'),
        '.css-class { color: blue; }'
      );

      await stringify({ baseDir: tempDir, output: true });

      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      expect(readme).to.include('.css-class');
    });

    it('缺少某些文件时不应该报错', async () => {
      // 删除 api.md
      await fs.remove(path.join(tempDir, 'doc/api.md'));

      const result = await stringify({ baseDir: tempDir, output: false });

      expect(result).to.have.property('readme');
      expect(result.data.api).to.equal('');
    });

    it('example.json 不存在时不应该报错', async () => {
      const result = await stringify({ baseDir: tempDir, output: false });

      expect(result).to.have.property('readme');
    });

    it('返回的 data 应该包含完整的结构', async () => {
      const result = await stringify({ baseDir: tempDir, output: false });

      expect(result.data).to.have.all.keys('name', 'description', 'summary', 'example', 'api');
      expect(result.data.name).to.equal('component');
      expect(result.data.description).to.equal('Test component');
      expect(result.data.summary).to.be.a('string');
      expect(result.data.api).to.be.a('string');
      expect(result.data.example).to.be.an('object');
    });
  });

  describe('集成测试', () => {
    it('stringify 和 parse 应该可以互相转换', async () => {
      // 创建完整的测试文件
      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: '@test/integration',
        description: 'Integration test',
        version: '1.0.0'
      });

      await fs.writeFile(
        path.join(tempDir, 'doc/summary.md'),
        'Summary content here.'
      );

      await fs.writeFile(
        path.join(tempDir, 'doc/api.md'),
        '### API\n\nAPI documentation.'
      );

      await fs.writeJson(path.join(tempDir, 'doc/example.json'), {
        list: [
          {
            title: 'Test Example',
            description: 'Test description',
            code: 'example.jsx',
            scope: [
              { name: 'Button', packageName: 'antd' }
            ]
          }
        ]
      });

      await fs.writeFile(
        path.join(tempDir, 'doc/example.jsx'),
        '<Button>Test</Button>'
      );

      // 执行 stringify
      await stringify({ baseDir: tempDir, output: true });

      // 读取生成的 README
      const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');

      // 执行 parse
      const parsed = parse(readme);

      // 验证
      expect(parsed.name).to.equal('integration');
      expect(parsed.summary).to.include('Summary content here');
      expect(parsed.api).to.include('API documentation');
      expect(parsed.example.list).to.have.lengthOf(1);
      expect(parsed.example.list[0].title).to.equal('Test Example');
      expect(parsed.example.list[0].code).to.include('Test');
    });
  });
});
