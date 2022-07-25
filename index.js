const fs = require('fs-extra');
const path = require('path');
const last = require('lodash/last');
const get = require('lodash/get');
const Markdown = require('markdown-it');
const {unescape} = require('html-escaper');
const crypto = require('crypto');
const {JSDOM} = require('jsdom');
const {document} = (new JSDOM()).window;
global.document = document;
const $ = require('jquery')(document.defaultView);

const baseDir = process.cwd();

const stringify = async () => {
    const data = {};

    await Promise.all([{
        dir: './doc/api.md',
        name: 'api'
    }, {
        dir: './doc/summary.md',
        name: 'summary'
    }, {
        dir: './doc/example.json',
        name: 'example'
    }, {
        dir: './doc/style.css',
        name: 'style'
    }, {
        dir: './doc/style.scss',
        name: 'style'
    }, {
        dir: './package.json',
        name: 'package'
    }].map(async ({dir, name}) => {
        const file = path.resolve(baseDir, dir);
        if (await fs.exists(file)) {
            if (/\.json$/.test(dir)) {
                data[name] = await fs.readJson(file);
                return;
            }

            data[name] = await fs.readFile(file, 'utf8');
        }
    }));

    await Promise.all((get(data, 'example.list') || []).map(async (item) => {
        Object.assign(item, {code: await fs.readFile(path.resolve(baseDir, './doc', item.code))});
    }));

    const readme = `
# ${last(data.package.name.split('/'))}

### 描述

${data.package.description || ''}

### 安装

\`\`\`shell
npm i --save ${data.package.name}
\`\`\`
${data.summary ? `
### 概述

${data.summary}` : ''}

### 示例${get(data, 'example.isFull') === true ? `(全屏)` : ''}

${data.style ? `
#### 示例样式

\`\`\`scss
${data.style.trim()}
\`\`\`
` : ''}
#### 示例代码

${(get(data, 'example.list') || []).map(({title, description, code, scope}) => {
        return `- ${title}
- ${description}
- ${(scope || []).map(({name, packageName}) => {
            return `${name}(${packageName})`
        }).join(',')}

\`\`\`jsx
${code}
\`\`\`
`;
    }).join('\n')}

### API

${data.api}
`;

    await fs.writeFile(path.resolve(baseDir, './README.md'), readme);
};

const parse = (text) => {
    const data = {};
    const md = new Markdown(),
        $dom = $(`<div>${md.render(text)}</div>`);
    const $domList = [].slice.call($dom.children(), 0);

    const name = $($domList.find((el) => $(el).is('h1'))).text();

    const summaryTitleIndex = $domList.findIndex((el) => {
        return $(el).is('h3') && $(el).text() === '概述';
    });

    const exampleTitleIndex = $domList.findIndex((el) => $(el).is("h3") && ["示例", "示例(全屏)"].indexOf($(el).text()) > -1);

    data.summary = $domList.filter((item, index) => index < exampleTitleIndex && index > summaryTitleIndex).map((item) => item.outerHTML).join("\n");

    const apiTitleIndex = $domList.findIndex((el, index) => {
        return $(el).is('h3') && $(el).text() === 'API';
    });


    data.api = $domList.filter((item, index) => index > apiTitleIndex).map((item) => item.outerHTML).join('\n');

    const exampleStyleIndex = $domList.findIndex((el, index) => {
        return $(el).is('h4') && $(el).text() === '示例样式';
    });

    data.example = {};

    data.example.isFull = !!$domList.find((el) => $(el).is('h4') && $(el).text() === '示例(全屏)');

    const styleString = $($domList[exampleStyleIndex + 1]).find('code').html();
    const styleId = name.replace(/[@\/\-]/g, '_') + '_' + crypto.createHash('md5').update(name).digest('hex').slice(0, 5);
    data.example.className = styleId;
    data.example.style = '';
    if (styleString) {
        const sass = require('node-sass');
        data.example.style = sass.renderSync({
            data: `.${styleId}{${unescape(styleString)}}`
        }).css.toString();
    }

    const exampleIndex = $domList.findIndex((el, index) => {
        return $(el).is('h4') && $(el).text() === '示例代码';
    });

    const example = $domList.filter((item, index) => index > exampleIndex && index < apiTitleIndex && $(item).is('pre')).map((item) => unescape($(item).find('code').html() || ''));
    const exampleProps = $domList.filter((item, index) => index > exampleIndex && index < apiTitleIndex && $(item).is('ul')).map((item) => {
        const output = [];
        $(item).find('li').each((index, item) => {
            output.push($(item).text());
        });
        return {
            title: output[0] || '',
            description: output[1] || '',
            scope: (output[2] || '').split(',').map((str) => {
                const matcher = str.match(/(.*)\((.*)\)/);
                if (matcher) {
                    return {
                        name: matcher[1],
                        packageName: matcher[2]
                    };
                }
            }).filter((item) => !!item)
        };
    });

    data.example.list = example.map((item, index) => {
        return Object.assign(exampleProps[index], {
            code: item
        });
    });
    return data;
};

module.exports = {stringify, parse};
