const webpack = require('webpack');
const WebpackBar = require('webpackbar');

module.exports={
  context: __dirname + "/src",
  entry: "./index",
  output:{
    filename:"app.js",
    path: __dirname
    },
  plugins: [
    new WebpackBar()
    ]
};
