# UD-Viz : Urban Data Vizualisation

[![CodeQL](https://github.com/VCityTeam/UD-Viz/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/VCityTeam/UD-Viz/actions/workflows/codeql-analysis.yml)
[![CI status](https://travis-ci.com/VCityTeam/UD-Viz.svg?branch=master)](https://app.travis-ci.com/github/VCityTeam/UD-Viz)
[![Documentation Status](https://readthedocs.org/projects/ansicolortags/badge/?version=latest)](http://vcityteam.github.io/UD-Viz/html/index.html)

UD-Viz is a javascript mono repository for creating web applications for visualizing and interacting with geospatial 3D urban data.

[Online documentation](https://vcityteam.github.io/UD-Viz/html/index.html) &mdash;
[Developers](./docs/static/Developers.md) &mdash;
[License](./LICENSE.md) &mdash;
[Getting Started](#getting-started) &mdash;
[Architecture](./docs/static/architecture.md)

**Online demos**:

<p>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-udviz-examples.html" ><img src="./img/UDVIZ-Examples.png" alt="UD-VizExamples Mosaic" width="32.5%"></a>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-flying-campus.html"><img src="./img/IMUV_Homepage.png" alt="IMUV Flying Campus Mosaic" width="32.5%"></a>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-deambulation-bron.html"><img src="./img/Deambulation Bron.png" alt="Deambulation Bron Mosaic" width="32.5%"></a>
</p>
<p>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-ui-data-driven.html" ><img src="./img/UI_Data_Driven.png" alt="UI Data Driven Mosaic" width="32.5%"></a>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-multi-dim-navigation.html"><img src="./img/MultimediaViz.png" alt="Multimedia Viz Mosaic" width="32.5%"></a>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-story-telling-gier.html"><img src="./img/Gier_Valley.png" alt="Multimedia Viz Mosaic" width="32.5%"></a>
</p>

_3D tiles related_

<p>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-py3dtilers.html"><img src="./img/3Dtiles.png" alt="Py3dTilers Mosaic" width="32.5%"></a>
  <a href="https://projet.liris.cnrs.fr/vcity/permalink/demo-point-cloud.html" ><img src="./img/PointClouds.png" alt="Point Clouds Mosaic" width="32.5%"></a>
</p>

### Directory Hierarchy

```
UD-Viz (repo)
├── bin                       # Monorepo scripts
├── docs                      # Documentation
├── examples                  # Examples of the ud-viz framework
├── test                      # Monorepo test scripts
├── packages                  # Packages folder
├── .eslintrc.js              # Linting rules and configuration
├── .gitignore                # Files/folders ignored by Git
├── .prettierrc               # Formatting rules
├── travis.yml                # Continuous integration entrypoint
├── favicon.ico               # Landing page icon
├── index.html                # Landing page entrypoint
├── package-lock.json         # Latest npm package installation file
├── package.json              # Global npm project description
├── Readme.md                 # It's a me, Mario!
├── style.css                 # Landing page style
```

**Github repositories:**

| Repository      | Link                                         | Description                                                                            |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| UD-Viz-docker   | <https://github.com/VCityTeam/UD-Viz-docker>   | Docker, which performs all the steps described in [Getting Started](#getting-started). |
| UD-Viz-template | <https://github.com/VCityTeam/UD-Viz-template> | A basis for creating your application using UD-Viz.                                    |

## Getting Started

### Installing node/npm

For the node/npm installation instructions refer [here](https://github.com/VCityTeam/UD-SV/blob/master/Tools/ToolNpm.md)

UD-Viz has been reported to work with versions:

- node version 18.X
- npm version: 9.X

### Installing the UD-Viz framework per se

Clone the UD-Viz repository and install requirements with npm

```bash
git clone https://github.com/VCityTeam/UD-Viz.git
cd UD-Viz
npm install # resolve dependencies based on the package.json (and package-lock.json if it exists)
```

#### Install ImageMagick and GraphicsMagick

For the install [imagemagick](https://imagemagick.org/index.php) and [graphicsmagick](http://www.graphicsmagick.org/) binary sub dependencies since the server needs [gm](https://www.npmjs.com/package/gm?activeTab=readme).

- **Linux**

  ```bash
   sudo apt-get install -y imagemagick graphicsmagick
  ```

- **Windows**
  - It seems not necessary to install imagemagick on windows.
  - Download and install graphicsmagick from [graphicmagick-binaries](https://sourceforge.net/projects/graphicsmagick/files/graphicsmagick-binaries/) (@ud-viz/game_node_template has been reported to work with version 1.3.34-Q8)

  > ⚠️ TIP : allias `gm` doesn't work in powershell because it conflicts with the command Get-Member !!!!
- **OSX**

  ```bash
  brew install imagemagick graphicsmagick
  ```

### How to run it locally?

```bash
npm run start
```

After running go to [localhost:8000](http://localhost:8000) which links to [documentation](./docs/) and [examples](./examples/)
