/* eslint-disable semi */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const HtmlWebPackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const Dotenv = require('dotenv-webpack');
const path = require('path')
const deps = require("./package.json").dependencies;

const printCompilationMessage = require('./compilation.config.js');

module.exports = (_, argv) => ({
  output: {
    publicPath: "http://localhost:3000/",
    path: path.resolve(__dirname, 'dist')
  },

  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },

  devServer: {
    port: 3000,
    allowedHosts: ['.csb.app'],
    historyApiFallback: true,
    watchFiles: [path.resolve(__dirname, 'src')],
    onListening: function (devServer) {
      const port = devServer.server.address().port

      printCompilationMessage('compiling', port)

      devServer.compiler.hooks.done.tap('OutputMessagePlugin', (stats) => {
        setImmediate(() => {
          if (stats.hasErrors()) {
            printCompilationMessage('failure', port)
          } else {
            printCompilationMessage('success', port)
          }
        })
      })
    }
  },

  module: {
    rules: [
      {
        test: /\.m?js/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false,
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
      },{
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
        aquamesh_system_lens: "aquamesh_system_lens@http://localhost:3001/remoteEntry.js",
        aquamesh_control_flow: "aquamesh_control_flow@http://localhost:3002/remoteEntry.js"
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
