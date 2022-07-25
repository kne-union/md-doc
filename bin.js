#!/usr/bin/env node
const chokidar = require('chokidar');
const index = require('./index');
const path = require('path');

const args = process.argv.slice(2);

index.stringify().catch((e) => {
    console.error(e);
});

if (args.indexOf('--watch') > -1) {
    chokidar.watch([path.resolve(process.cwd(), 'doc'), path.resolve(process.cwd(), 'package.json')]).on('all', (event, path) => {
        index.stringify().catch((e) => {
            console.error(e);
        });
    });
}
