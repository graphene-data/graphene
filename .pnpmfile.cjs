module.exports = {
  hooks: {
    readPackage (pkg) {
      if (pkg && pkg.name === 'apache-arrow') {
        // Remove broken CLI bin mapping to avoid install-time bin warnings
        delete pkg.bin
      }
      return pkg
    },
  },
}
