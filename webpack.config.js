const path = require('path');

module.exports = {
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'main.js',
    library: {
      type: 'commonjs2'
    }
  },
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  externals: {
    obsidian: 'commonjs2 obsidian',
    electron: 'commonjs2 electron',
    '@codemirror/state': 'commonjs2 @codemirror/state',
    '@codemirror/view': 'commonjs2 @codemirror/view'
  },
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false
  }
};