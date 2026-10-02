# Coffee Grinder 3D

A 3D coffee grinder built with Three.js. Use the **Grind** and **Refill** buttons to grind beans and refill the hopper. Drag to orbit the camera.

Static site (index.html, main.js, style.css). Three.js is loaded from the jsDelivr CDN, so no build step is needed (internet required).

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000/.

## Deploy to GitHub Pages

Account `jsnilek`, repo `mill`, final URL: https://jsnilek.github.io/mill/

1. Create an empty repo named `mill` at https://github.com/new (account jsnilek).
2. Add the remote and push:
   ```
   git remote add origin https://github.com/jsnilek/mill.git
   git push -u origin main
   ```
3. On GitHub: Settings > Pages > Build and deployment > Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)`, Save.
4. Wait a minute, then open https://jsnilek.github.io/mill/.

All asset paths are relative, so the site works under the `/mill/` subpath.
