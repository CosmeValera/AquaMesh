/* eslint-disable semi */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const HtmlWebPackPlugin = require('html-webpack-plugin')
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const Dotenv = require('dotenv-webpack')
const deps = require('./package.json').dependencies
const path = require('path')
const fs = require('fs')

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
    path: path.join(__dirname, '/dist'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.(css|s[ac]ss)$/i,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: ['autoprefixer'],
              },
            },
          },
          'sass-loader',
        ],
      },
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
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
      name: 'studymesh',
      filename: 'remoteEntry.js',
      remotes: {
        aquamesh_system_lens:
          'aquamesh_system_lens@https://aquamesh-system-lens.vercel.app/remoteEntry.js',
        aquamesh_control_flow:
          'aquamesh_control_flow@https://aquamesh-control-flow.vercel.app/remoteEntry.js',
      },
      exposes: {},
      shared: {
        ...deps,
        react: {
          singleton: true,
          requiredVersion: deps.react,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: deps['react-dom'],
        },
      },
    }),
    new HtmlWebPackPlugin({
      template: './src/index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Copy favicon and icon files from public root
        {
          from: 'public/favicon.ico',
          to: './favicon.ico',
          noErrorOnMissing: true,
        },
        { from: 'public/logo.svg', to: './logo.svg', noErrorOnMissing: true },
        { from: 'public/logo.png', to: './logo.png', noErrorOnMissing: true },
        { from: 'public/logo.ico', to: './logo.ico', noErrorOnMissing: true },
        {
          from: 'public/logo192.png',
          to: './logo192.png',
          noErrorOnMissing: true,
        },
        {
          from: 'public/logo512.png',
          to: './logo512.png',
          noErrorOnMissing: true,
        },
        {
          from: 'public/robots.txt',
          to: './robots.txt',
          noErrorOnMissing: true,
        },
        {
          from: 'public/popout.html',
          to: './popout.html',
          noErrorOnMissing: true,
        },
        // Copy config and images
        {
          from: 'public/config/widgets-prod.json',
          to: './config/widgets.json',
          noErrorOnMissing: true,
        },
        { from: 'public/images', to: './images', noErrorOnMissing: true },
        // Dev serves public/ wholesale, prod only copies what is listed here.
        // The landing trailer and the demo podcast audio are both loaded by
        // absolute URL, so they 404 in production unless copied.
        // No noErrorOnMissing here on purpose: a missing trailer is what made
        // the landing hero a black box, and a failed build says so louder.
        {
          from: 'public/videos/trailer.mp4',
          to: './videos/trailer.mp4',
        },
        {
          from: 'public/videos/trailer-poster.jpg',
          to: './videos/trailer-poster.jpg',
        },
        { from: 'public/demo', to: './demo', noErrorOnMissing: true },
        {
          from: path.resolve(
            __dirname,
            '../../node_modules/pdfjs-dist/build/pdf.worker.min.js',
          ),
          to: './pdf.worker.min.js',
          noErrorOnMissing: true,
        },
      ],
    }),
    new CleanWebpackPlugin(),
    new Dotenv({
      path: fs.existsSync(
        path.resolve(__dirname, `.env.${argv.mode || 'production'}`),
      )
        ? `./.env.${argv.mode || 'production'}`
        : './.env',
      systemvars: true, // Load all system variables as well (useful for CI/CD)
    }),
  ],
})
