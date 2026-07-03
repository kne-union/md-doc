const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { stringify, parse } = require('../index');

const EXAMPLE_DRIVER_ROOT = path.resolve(__dirname, '../../example-driver');
const EXAMPLE_DRIVER_DOC = path.join(EXAMPLE_DRIVER_ROOT, 'doc');

const setupMinimalDocProject = async (tempDir) => {
  await fs.writeJson(path.join(tempDir, 'package.json'), {
    name: '@test/backtick',
    description: 'Backtick roundtrip test',
    version: '1.0.0'
  });
  await fs.writeFile(path.join(tempDir, 'doc/summary.md'), 'Summary');
  await fs.writeFile(path.join(tempDir, 'doc/api.md'), '### API\n\nAPI');
};

const writeExampleFromFiles = async (tempDir, exampleJson, codeFiles) => {
  await fs.writeJson(path.join(tempDir, 'doc/example.json'), exampleJson);
  await Promise.all(
    Object.entries(codeFiles).map(([filename, content]) =>
      fs.writeFile(path.join(tempDir, 'doc', filename), content)
    )
  );
};

const countChar = (str, char) => (str.match(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

const assertParsedCodeMatchesSource = (parsedCode, sourceCode, label) => {
  expect(parsedCode, `${label}: parsed code should be a string`).to.be.a('string');
  expect(parsedCode, `${label}: should not contain HTML entity &#96;`).to.not.include('&#96;');
  expect(parsedCode, `${label}: should not contain &amp;#96;`).to.not.include('&amp;#96;');
  expect(parsedCode.trim(), `${label}: code content should match source`).to.equal(sourceCode.trim());
  expect(
    countChar(parsedCode, '`'),
    `${label}: backtick count should be preserved`
  ).to.equal(countChar(sourceCode, '`'));
};

/** 模拟 modules-dev readme-generator 将 code 嵌入模板字符串 */
const embedCodeLikeReadmeGenerator = (code) => {
  const escaped = (code || '').toString().replace(/\$/g, '\\$').replace(/`/g, '\\`');
  // eslint-disable-next-line no-new-func
  return Function(`return \`${escaped}\`;`)();
};

describe('md-doc doc 示例反引号往返', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'md-doc-backtick-test-' + Date.now());
    await fs.ensureDir(path.join(tempDir, 'doc'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('应该往返转换嵌套模板字符串的 doc 示例（base.js 模式）', async () => {
    const baseLikeCode = `const {default: ExampleDriver} = _ExampleDriver;

// 示例代码字符串
const code = \`
const { Button, Card, Space } = antd;
const { useState } = React;

const Component = () => {
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: '12px' }}>
      <Card>
        <h4 style={{ marginBottom: '12px' }}>计数器示例</h4>
        <Space>
          <Button onClick={() => setCount(count - 1)}>-</Button>
          <span style={{ fontSize: '18px' }}>{count}</span>
          <Button onClick={() => setCount(count + 1)}>+</Button>
          <Button onClick={() => setCount(0)} danger>重置</Button>
        </Space>
      </Card>
    </div>
  );
};

render(<Component />);
\`;

render(<ExampleDriver list={[{
    title: '基本使用', description: 'ExampleDriver 的基础用法', code, scope: [{
        name: 'antd', packageName: 'antd', component: antd
    }]
}]}/>);
`;

    await setupMinimalDocProject(tempDir);
    await writeExampleFromFiles(
      tempDir,
      {
        list: [
          {
            title: '基础使用',
            description: '嵌套模板字符串示例',
            code: './base.js',
            scope: []
          }
        ]
      },
      { 'base.js': baseLikeCode }
    );

    const { readme } = await stringify({ baseDir: tempDir, output: false });
    expect(readme).to.include('&#96;');
    expect(readme).to.not.match(/```jsx[\s\S]*const code = `(?!&#96;)/);

    const parsed = parse(readme);
    assertParsedCodeMatchesSource(parsed.example.list[0].code, baseLikeCode, 'base.js 模式');

    const embedded = embedCodeLikeReadmeGenerator(parsed.example.list[0].code);
    assertParsedCodeMatchesSource(embedded, baseLikeCode, 'readme-generator 嵌入后');
  });

  it('stringify → parse 重复解析后代码仍应一致', async () => {
    const sourceCode = [
      'const outer = `inner \\`nested\\` value`;',
      'const tpl = `line1',
      'line2`;',
      'const code = `',
      'render(<App />);',
      '`;'
    ].join('\n');

    await setupMinimalDocProject(tempDir);
    await writeExampleFromFiles(
      tempDir,
      {
        list: [{ title: '重复解析', description: 'desc', code: './sample.js', scope: [] }]
      },
      { 'sample.js': sourceCode }
    );

    const { readme } = await stringify({ baseDir: tempDir, output: false });
    const firstParse = parse(readme);
    const secondParse = parse(readme);

    assertParsedCodeMatchesSource(firstParse.example.list[0].code, sourceCode, '第一次 parse');
    assertParsedCodeMatchesSource(secondParse.example.list[0].code, sourceCode, '第二次 parse');
    expect(firstParse.example.list[0].code).to.equal(secondParse.example.list[0].code);
  });

  const exampleDriverDescribe = fs.existsSync(EXAMPLE_DRIVER_DOC)
    ? describe
    : describe.skip;

  exampleDriverDescribe('example-driver doc 目录真实文件', () => {
    it('所有含反引号的 doc 示例应能 stringify → parse 无损往返', async () => {
      const exampleJson = await fs.readJson(path.join(EXAMPLE_DRIVER_DOC, 'example.json'));
      const summary = await fs.readFile(path.join(EXAMPLE_DRIVER_ROOT, 'doc/summary.md'), 'utf8').catch(() => 'Summary');
      const api = await fs.readFile(path.join(EXAMPLE_DRIVER_ROOT, 'doc/api.md'), 'utf8').catch(() => '### API\n\nAPI');

      await fs.writeJson(path.join(tempDir, 'package.json'), {
        name: (await fs.readJson(path.join(EXAMPLE_DRIVER_ROOT, 'package.json'))).name,
        description: 'example-driver doc test',
        version: '1.0.0'
      });
      await fs.writeFile(path.join(tempDir, 'doc/summary.md'), summary);
      await fs.writeFile(path.join(tempDir, 'doc/api.md'), api);
      await fs.writeJson(path.join(tempDir, 'doc/example.json'), exampleJson);

      const codeFiles = {};
      for (const item of exampleJson.list) {
        const codePath = item.code && item.code.replace(/^\.\//, '');
        if (!codePath) continue;
        const absolutePath = path.join(EXAMPLE_DRIVER_DOC, codePath);
        if (!(await fs.pathExists(absolutePath))) continue;
        codeFiles[codePath] = await fs.readFile(absolutePath, 'utf8');
        await fs.writeFile(path.join(tempDir, 'doc', codePath), codeFiles[codePath]);
      }

      const { readme } = await stringify({ baseDir: tempDir, output: false });
      const parsed = parse(readme);

      expect(parsed.example.list).to.have.lengthOf(exampleJson.list.length);

      parsed.example.list.forEach((item, index) => {
        const codePath = exampleJson.list[index].code && exampleJson.list[index].code.replace(/^\.\//, '');
        if (!codePath || !codeFiles[codePath]) return;

        const sourceCode = codeFiles[codePath];
        if (!sourceCode.includes('`')) return;

        assertParsedCodeMatchesSource(item.code, sourceCode, `${codePath} (${item.title})`);

        const embedded = embedCodeLikeReadmeGenerator(item.code);
        assertParsedCodeMatchesSource(embedded, sourceCode, `${codePath} webpack 嵌入`);
      });
    });

    it('example-driver 全量 example.json 往返后 isFull 等元数据不丢失', async () => {
      const exampleJson = await fs.readJson(path.join(EXAMPLE_DRIVER_DOC, 'example.json'));

      await setupMinimalDocProject(tempDir);
      await writeExampleFromFiles(tempDir, exampleJson, {});

      for (const item of exampleJson.list) {
        const codePath = item.code && item.code.replace(/^\.\//, '');
        if (!codePath) continue;
        const absolutePath = path.join(EXAMPLE_DRIVER_DOC, codePath);
        if (await fs.pathExists(absolutePath)) {
          await fs.copy(absolutePath, path.join(tempDir, 'doc', codePath));
        }
      }

      const { readme } = await stringify({ baseDir: tempDir, output: false });
      const parsed = parse(readme);

      expect(parsed.example.isFull).to.equal(exampleJson.isFull === true);
      expect(parsed.example.list[0].title).to.equal(exampleJson.list[0].title);

      const layoutItem = parsed.example.list.find((item) => item.title === '双列布局');
      if (layoutItem) {
        expect(layoutItem.code).to.include('isFull: true');
        expect(layoutItem.code).to.not.include('&#96;');
      }
    });
  });
});
