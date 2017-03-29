/* eslint-env node */
/* eslint-disable import/no-commonjs */

require("babel-register");
require("babel-polyfill");

var webpack = require('webpack');
var webpackPostcssTools = require('webpack-postcss-tools');

var ExtractTextPlugin = require('extract-text-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var UnusedFilesWebpackPlugin = require("unused-files-webpack-plugin").default;
var BannerWebpackPlugin = require('banner-webpack-plugin');

var _ = require('underscore');
var glob = require('glob');
var fs = require('fs');

var chevrotain = require("chevrotain");
var allTokens = require("./frontend/src/metabase/lib/expressions/tokens").allTokens;

function hasArg(arg) {
    var regex = new RegExp("^" + ((arg.length === 2) ? ("-\\w*"+arg[1]+"\\w*") : (arg)) + "$");
    return process.argv.filter(regex.test.bind(regex)).length > 0;
}

var SRC_PATH = __dirname + '/frontend/src/metabase';
var BUILD_PATH = __dirname + '/resources/frontend_client';


// Need to scan the CSS files for variable and custom media used across files
// NOTE: this requires "webpack -w" (watch mode) to be restarted when variables change :(
var isWatching = hasArg("-w") || hasArg("--watch");
if (isWatching) {
    console.warn("Warning: in webpack watch mode you must restart webpack if you change any CSS variables or custom media queries");
}

// default NODE_ENV to development
var NODE_ENV = process.env["NODE_ENV"] || "development";
process.stderr.write("webpack env: " + NODE_ENV + "\n");

// Babel:
var BABEL_CONFIG = {
    cacheDirectory: ".babel_cache"
};

// Build mapping of CSS variables
var CSS_SRC = glob.sync(SRC_PATH + '/css/**/*.css');
var CSS_MAPS = { vars: {}, media: {}, selector: {} };
CSS_SRC.map(webpackPostcssTools.makeVarMap).forEach(function(map) {
    for (var name in CSS_MAPS) _.extend(CSS_MAPS[name], map[name]);
});

// CSS Next:
var CSSNEXT_CONFIG = {
    features: {
        // pass in the variables and custom media we scanned for before
        customProperties: { variables: CSS_MAPS.vars },
        customMedia: { extensions: CSS_MAPS.media }
    },
    import: {
        path: ['resources/frontend_client/app/css']
    },
    compress: false
};

var CSS_CONFIG = {
    localIdentName: NODE_ENV !== "production" ?
        "[name]__[local]___[hash:base64:5]" :
        "[hash:base64:5]",
    restructuring: false,
    compatibility: true,
    importLoaders: 1
}

var config = module.exports = {
    context: SRC_PATH,

    // output a bundle for the app JS and a bundle for styles
    // eventually we should have multiple (single file) entry points for various pieces of the app to enable code splitting
    entry: {
        "app-main": './app-main.js',
        "app-public": './app-public.js',
        "app-embed": './app-embed.js',
        styles: './css/index.css',
    },

    // output to "dist"
    output: {
        path: BUILD_PATH + '/app/dist',
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        filename: '[name].bundle.js?[hash]',
        publicPath: '/app/dist/'
    },

    module: {
        loaders: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                loader: "babel",
                query: BABEL_CONFIG
            },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules|\.spec\.js/,
                loader: 'eslint'
            },
            {
                test: /\.(eot|woff2?|ttf|svg|png)$/,
                loader: "file-loader"
            },
            {
                test: /\.json$/,
                loader: "json-loader"
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader?" + JSON.stringify(CSS_CONFIG) + "!postcss-loader")
            }
        ],
        noParse: [
            /node_modules\/(ace|moment|underscore)/ // doesn't include 'crossfilter', 'dc', and 'tether' due to use of 'require'
        ]
    },

    resolve: {
        extensions: ["", ".webpack.js", ".web.js", ".js", ".jsx", ".css"],
        alias: {
            'metabase':             SRC_PATH,
            'style':                SRC_PATH + '/css/core/index.css',

            'ace':                  __dirname + '/node_modules/ace-builds/src-min-noconflict',

            // misc
            'moment':               __dirname + '/node_modules/moment/min/moment.min.js',
            'tether':               __dirname + '/node_modules/tether/dist/js/tether.min.js',
            'underscore':           __dirname + '/node_modules/underscore/underscore-min.js',
            'd3':                   __dirname + '/node_modules/d3/d3.min.js',
            'crossfilter':          __dirname + '/node_modules/crossfilter/index.js',
            'dc':                   __dirname + '/node_modules/dc/dc.min.js',
            'humanize':             __dirname + '/node_modules/humanize-plus/dist/humanize.min.js'
        }
    },

    plugins: [
        new UnusedFilesWebpackPlugin({
            globOptions: {
                ignore: [
                    "**/types/*.js",
                    "**/*.spec.*"
                ]
            }
        }),
        // Extracts initial CSS into a standard stylesheet that can be loaded in parallel with JavaScript
        // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
        new ExtractTextPlugin('[name].bundle.css?[contenthash]'),
        new HtmlWebpackPlugin({
            filename: '../../index.html',
            chunks: ["app-main", "styles"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head'
        }),
        new HtmlWebpackPlugin({
            filename: '../../public.html',
            chunks: ["app-public", "styles"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head'
        }),
        new HtmlWebpackPlugin({
            filename: '../../embed.html',
            chunks: ["app-embed", "styles"],
            template: __dirname + '/resources/frontend_client/index_template.html',
            inject: 'head'
        }),
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(NODE_ENV)
            }
        }),
        new BannerWebpackPlugin({
            chunks: {
                'app-main': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
                },
                'app-public': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
                },
                'app-embed': {
                    beforeContent: "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE-EMBEDDING.txt', which is part of this source code package.\n */\n",
                },
            }
        }),
    ],

    postcss: function (webpack) {
        return [
            require("postcss-import")(),
            require("postcss-url")(),
            require("postcss-cssnext")(CSSNEXT_CONFIG)
        ]
    }
};

if (NODE_ENV === "hot") {
    // suffixing with ".hot" allows us to run both `yarn run build-hot` and `yarn run test` or `yarn run test-watch` simultaneously
    config.output.filename = "[name].hot.bundle.js?[hash]";

    // point the publicPath (inlined in index.html by HtmlWebpackPlugin) to the hot-reloading server
    config.output.publicPath = "http://localhost:8080" + config.output.publicPath;

    config.module.loaders.unshift({
        test: /\.jsx$/,
        exclude: /node_modules/,
        loaders: ['react-hot', 'babel?'+JSON.stringify(BABEL_CONFIG)]
    });

    // disable ExtractTextPlugin
    config.module.loaders[config.module.loaders.length - 1].loader = "style-loader!css-loader?" + JSON.stringify(CSS_CONFIG) + "!postcss-loader"

    config.devServer = {
        hot: true,
        inline: true,
        contentBase: "frontend"
        // if you want to reduce stats noise
        // stats: 'minimal' // values: none, errors-only, minimal, normal, verbose
    };

    config.plugins.unshift(
        new webpack.NoErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin()
    );
}

if (NODE_ENV !== "production") {
    // replace minified files with un-minified versions
    for (var name in config.resolve.alias) {
        var minified = config.resolve.alias[name];
        var unminified = minified.replace(/[.-\/]min\b/g, '');
        if (minified !== unminified && fs.existsSync(unminified)) {
            config.resolve.alias[name] = unminified;
        }
    }

    // enable "cheap" source maps in hot or watch mode since re-build speed overhead is < 1 second
    config.devtool = "cheap-module-source-map";

    // works with breakpoints
    // config.devtool = "inline-source-map"

    // helps with source maps
    config.output.devtoolModuleFilenameTemplate = '[absolute-resource-path]';
    config.output.pathinfo = true;
} else {
    // this is required to ensure we don't minify Chevrotain token identifiers
    // https://github.com/SAP/chevrotain/tree/master/examples/parser/minification
    config.plugins.push(new webpack.optimize.UglifyJsPlugin({
        mangle: {
            except: allTokens.map(function(currTok) {
                return chevrotain.tokenName(currTok);
            })
        }
    }))

    config.devtool = "source-map";
}
