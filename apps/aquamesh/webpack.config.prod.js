/* eslint-disable semi */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const HtmlWebPackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const Dotenv = require('dotenv-webpack');
const deps = require('./package.json').dependencies;
const path = require('path');

module.exports = (_, argv) => ({
  // mode: 'production',
  // entry: '/src/index.js',
  cache: false,
  devtool: false,
  optimization: {
    minimize: true,
  },
  output: {
    // you could use 'auto', but 'auto' does not work with ie11, it's better to use relative url anyway.
    publicPath: '/',
    clean: true,
    pathinfo: false,
    path: path.join(__dirname, '/dist')
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'swc-loader',
        options: {
          cacheDirectory: true,
        },
      },
      {
        test: /\.(css|s[ac]ss)$/i,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [
                  "autoprefixer",
                ],
              },
            },
          },
          "sass-loader",
        ],
      },
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      }, {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgo: false,
            },
          },
          'url-loader',
        ],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "aquamesh",
      filename: "remoteEntry.js",
      remotes: {
        remote_app: "remote_app@http://localhost:3001/remoteEntry.js",
      },
      exposes: {},
      shared: {
        ...deps,
        react: {
          singleton: true,
          requiredVersion: deps.react,
        },
        "react-dom": {
          singleton: true,
          requiredVersion: deps["react-dom"],
        },
      },
    }),
    new HtmlWebPackPlugin({
      template: "./src/index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/config/widgets.json', to: './config/', noErrorOnMissing: true }
      ],
    }),
    new CleanWebpackPlugin(),
    new Dotenv({
      path: `./.env.${argv.mode}`,
    }),
  ],
});
