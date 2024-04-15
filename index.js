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

const getSassModule = () => {
    try {
        return require('sass');
    } catch (e) {
        console.warn('sass没有安装尝试使用node-sass');
    }
    try {
        return require('node-sass');
    } catch (e) {
        console.warn('node-sass没有安装');
    }

    console.warn('请至少安装sass或者node-sass中的一个用来编译sass样式文件');
};

const styleTransform = (name, styleString) => {
    const output = {};
    const styleId = name.replace(/[@\/\-]/g, '_') + '_' + crypto.createHash('md5').update(name).digest('hex').slice(0, 5);
    output.className = styleId;
    output.style = '';
    if (!styleString) {
        return output;
    }
    const sass = getSassModule();
    if (!sass) {
        return output;
    }
    output.style = sass.renderSync({
        data: `.${styleId}{${unescape(styleString)}}`
    }).css.toString();
    return output;
};

const stringify = async (options) => {
    options = Object.assign({baseDir, output: true}, options);
    const data = {};

    await Promise.all([{
        dir: './doc/api.md', name: 'api'
    }, {
        dir: './doc/summary.md', name: 'summary'
    }, {
        dir: './doc/example.json', name: 'example'
    }, {
        dir: './doc/style.css', name: 'style'
    }, {
        dir: './doc/style.scss', name: 'style'
    }, {
        dir: './package.json', name: 'package'
    }].map(async ({dir, name}) => {
        const file = path.resolve(options.baseDir, dir);
        if (await fs.exists(file)) {
            if (/\.json$/.test(dir)) {
                data[name] = await fs.readJson(file);
                return;
            }

            data[name] = await fs.readFile(file, 'utf8');
        }
    }));

    await Promise.all((get(data, 'example.list') || []).map(async (item) => {
        const codeFileDir = path.resolve(options.baseDir, './doc', item.code);
        if (await fs.exists(codeFileDir)) {
            Object.assign(item, {code: await fs.readFile(path.resolve(options.baseDir, './doc', item.code))});
        }
    }));

    const md = new Markdown();
    const name = options.name || last(get(data, 'package.name', '').split('/'));
    const outputData = {
        name,
        packageName: get(data, 'package.name', ''),
        description: get(data, 'package.description', ''),
        summary: data.summary,
        summaryMD: md.render(data.summary || ''),
        style: (data.style || '').trim(),
        styleObject: styleTransform(name, data.style),
        example: data.example,
        api: data.api || '',
        apiMd: md.render(data.api || '')
    };

    const readme = `
# ${outputData.name}

${outputData.description ? `
### 描述

${outputData.description}

` : ''}${outputData.packageName ? `
### 安装

\`\`\`shell
npm i --save ${outputData.packageName}
\`\`\`

` : ''}${outputData.summary ? `
### 概述

${outputData.summary}

` : ''}### 示例${get(outputData, 'example.isFull') === true ? `(全屏)` : ''}

${outputData.style ? `
#### 示例样式

\`\`\`scss
${outputData.style}
\`\`\`

` : ''}#### 示例代码

${(get(outputData, 'example.list') || []).map(({title, description, code, scope}) => {
        return `- ${title}
- ${description}
- ${(scope || []).map(({name, packageName}) => {
            return `${name ? name : ''}(${packageName})`
        }).join(',')}

\`\`\`jsx
${code}
\`\`\`
`;
    }).join('\n')}

### API

${outputData.api}
`;
    if (options.output) {
        await fs.writeFile(path.resolve(options.baseDir, './README.md'), readme);
    }
    return {
        readme, data: {
            name: outputData.name,
            description: outputData.description,
            summary: outputData.summaryMD,
            example: Object.assign({}, data.example, outputData.styleObject),
            api: outputData.apiMd
        }
    };
};

const parse = (text) => {
    const data = {};
    const md = new Markdown(), $dom = $(`<div>${md.render(text)}</div>`);
    const $domList = [].slice.call($dom.children(), 0);

    const name = $($domList.find((el) => $(el).is('h1'))).text();

    const summaryTitleIndex = $domList.findIndex((el) => {
        return $(el).is('h3') && $(el).text() === '概述';
    });

    const exampleTitleIndex = $domList.findIndex((el) => $(el).is("h3") && ["示例", "示例(全屏)"].indexOf($(el).text()) > -1);

    data.name = name;

    data.summary = $domList.filter((item, index) => index < exampleTitleIndex && index > summaryTitleIndex).map((item) => item.outerHTML).join("\n");

    const apiTitleIndex = $domList.findIndex((el, index) => {
        return $(el).is('h3') && $(el).text() === 'API';
    });


    data.api = $domList.filter((item, index) => index > apiTitleIndex).map((item) => item.outerHTML).join('\n');

    const exampleStyleIndex = $domList.findIndex((el, index) => {
        return $(el).is('h4') && $(el).text() === '示例样式';
    });

    data.example = {};

    data.example.isFull = !!$domList.find((el) => $(el).is('h3') && $(el).text() === '示例(全屏)');

    const styleString = $($domList[exampleStyleIndex + 1]).find('code').html();
    const styleObject = styleTransform(name, styleString);
    data.example.className = styleObject.className;
    data.example.style = styleObject.style;

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
            title: output[0] || '', description: output[1] || '', scope: (output[2] || '').split(',').map((str) => {
                const matcher = str.match(/(.*)\((.*)\)/);
                if (matcher) {
                    return {
                        name: matcher[1], packageName: matcher[2]
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
