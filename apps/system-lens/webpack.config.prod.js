const HtmlWebPackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const Dotenv = require('dotenv-webpack');
const path = require('path');
const deps = require("./package.json").dependencies;

module.exports = (_, argv) => ({
  cache: false,
  devtool: false,
  optimization: {
    minimize: true,
  },
  output: {
    publicPath: '/',
    clean: true,
    pathinfo: false,
    path: path.join(__dirname, '/dist')
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },

  module: {
    rules: [
      {
        test: /\.(css|s[ac]ss)$/i,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: "asset/resource",
      },
    ],
  },

  plugins: [
    new ModuleFederationPlugin({
      name: "aquamesh_system_lens",
      filename: "remoteEntry.js",
      remotes: {},
      exposes: {
        "./SystemLensMain": "./src/Main"
      },
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
    new CleanWebpackPlugin(),
    new Dotenv({
      path: `./.env.${argv.mode || 'production'}`,
      systemvars: true, // Load all system variables as well (useful for CI/CD)
    }),
  ],
}); 