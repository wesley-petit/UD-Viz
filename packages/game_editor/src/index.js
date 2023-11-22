import {
  AudioComponent,
  ColliderComponent,
  Context,
  Object3D as GameObject3D,
  RenderComponent,
} from '@ud-viz/game_shared';
import { AssetManager, RenderController } from '@ud-viz/game_browser';
import {
  Object3D,
  Box3,
  Vector3,
  Quaternion,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  CircleGeometry,
  Color,
  Raycaster,
  Vector2,
  SphereGeometry,
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  AmbientLight,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry';

import './style.css';
import {
  cameraFitRectangle,
  createLabelInput,
  createLocalStorageSlider,
  RequestAnimationFrameProcess,
  Vector3Input,
} from '@ud-viz/utils_browser';
import { arrayPushOnce, removeFromArray } from '@ud-viz/utils_shared';

const COLLIDER_MATERIAL = new MeshBasicMaterial({ color: 'green' });
const COLLIDER_MATERIAL_SELECTED = new MeshBasicMaterial({ color: 'red' });
const COLLIDER_POINT_MATERIAL = new MeshBasicMaterial({ color: 'yellow' });

export class Editor {
  /**
   *
   * @param {import("@ud-viz/frame3d").Planar|import("@ud-viz/frame3d").Base} frame3D
   * @param {AssetManager} assetManager
   */
  constructor(frame3D, assetManager) {
    /** @type {import("@ud-viz/frame3d").Planar|import("@ud-viz/frame3d").Base} */
    this.frame3D = frame3D;

    /** @type {AssetManager} */
    this.assetManager = assetManager;

    /** @type {HTMLElement} */
    this.leftPan = document.createElement('div');
    this.leftPan.setAttribute('id', 'left_pan');
    this.frame3D.domElementUI.appendChild(this.leftPan);

    const leftPanWidthInput = createLocalStorageSlider(
      'editor_left_width_range_key',
      'Taille UI ',
      this.leftPan,
      {
        min: 100,
        max: 700,
        defaultValue: 300,
      }
    );
    const updateLeftWidth = () => {
      this.leftPan.style.width = leftPanWidthInput.value + 'px';
    };
    leftPanWidthInput.onchange = updateLeftWidth;
    updateLeftWidth();

    /** @type {HTMLElement} */
    this.currentGODomelement = document.createElement('div');
    this.currentGODomelement.setAttribute('id', 'current_game_object_3d');
    this.leftPan.appendChild(this.currentGODomelement);

    /** @type {HTMLElement} */
    this.toolsDomElement = document.createElement('div');
    this.toolsDomElement.setAttribute('id', 'editor_tools');
    this.leftPan.appendChild(this.toolsDomElement);

    const possibleIdRenderData = [];
    for (const id in assetManager.renderData) possibleIdRenderData.push(id);
    const possibleIdSounds = [];
    for (const id in assetManager.sounds) possibleIdSounds.push(id);
    /** @type {GameObject3DInput} */
    this.gameObjectInput = new GameObject3DInput(
      possibleIdRenderData,
      possibleIdSounds
    );
    this.gameObjectInput.setAttribute('id', 'select_game_object_3d');
    this.leftPan.appendChild(this.gameObjectInput);

    /** @type {OrbitControls} */
    this.orbitControls = new OrbitControls(
      this.frame3D.camera,
      this.frame3D.domElementWebGL
    );

    /** @type {TransformControls} */
    this.transformControls = new TransformControls(
      this.frame3D.camera,
      this.frame3D.domElementWebGL
    );
    {
      this.frame3D.scene.add(this.transformControls);

      this.transformControls.addEventListener('dragging-changed', (event) => {
        this.orbitControls.enabled = !event.value;
      });

      this.transformControls.addEventListener('change', () => {
        this.gameObjectInput.updateTransform();
      });
      this.transformControls.addEventListener('mouseUp', () => {
        if (!this.shapeContext.pointMesh) {
          // editing go transform
          this.updateCollider();
          this.updateBox3();
        } else {
          if (
            this.shapeContext.pointMesh.userData.shapeJSON.type ==
            ColliderComponent.SHAPE_TYPE.POLYGON
          ) {
            // editing point shape in model
            this.shapeContext.pointMesh.userData.shapeJSON.points[
              this.shapeContext.pointMesh.userData.index
            ] = {
              x: this.shapeContext.pointMesh.position.x,
              y: this.shapeContext.pointMesh.position.y,
              z: this.shapeContext.pointMesh.position.z,
            };
            const indexPointSelected =
              this.shapeContext.pointMesh.userData.index;
            this.updateShapeSelected();
            this.selectPointMesh(
              this.pointsParent.children[indexPointSelected]
            );
          } else {
            // circle center edited
            this.shapeContext.pointMesh.userData.shapeJSON.center = {
              x: this.shapeContext.pointMesh.position.x,
              y: this.shapeContext.pointMesh.position.y,
              z: this.shapeContext.pointMesh.position.z,
            };
            this.updateShapeSelected();
          }
        }
      });
    }

    // gizmo mode ui
    {
      const addButtonMode = (mode) => {
        const buttonMode = document.createElement('button');
        buttonMode.innerText = mode;
        this.toolsDomElement.appendChild(buttonMode);

        buttonMode.onclick = () => {
          this.transformControls.setMode(mode);
        };
      };
      addButtonMode('translate');
      addButtonMode('rotate');
      addButtonMode('scale');
    }

    /** @type {HTMLElement} */
    this.buttonTargetGameObject3D = document.createElement('button');
    this.buttonTargetGameObject3D.innerText = 'Target';
    this.toolsDomElement.appendChild(this.buttonTargetGameObject3D);

    /** @type {RequestAnimationFrameProcess} */
    this.process = new RequestAnimationFrameProcess(20);
    this.process.start(() => {
      this.transformControls.updateMatrixWorld();
      this.frame3D.render();
    });

    /** @type {GameObject3D|null} */
    this.currentGameObject3D = null;

    /** @type {Box3} */
    this.currentGameObjectMeshBox3 = new Mesh(
      new BoxGeometry(),
      new MeshBasicMaterial({ color: 'black', wireframe: true })
    );
    {
      this.currentGameObjectMeshBox3.name = 'currentGameObjectMeshBox3';
      this.frame3D.scene.add(this.currentGameObjectMeshBox3);
      this.gameObjectInput.addEventListener(
        GameObject3DInput.EVENT.TRANSFORM_CHANGED,
        () => {
          this.updateBox3();
          this.updateCollider();
        }
      );
    }

    // camera move
    {
      const selectCameraPOV = document.createElement('select');
      this.toolsDomElement.appendChild(selectCameraPOV);

      const buffer = new Map();
      const addOption = (label, callback) => {
        const option = document.createElement('option');
        option.innerText = label;
        option.value = label;
        buffer.set(label, callback);
        selectCameraPOV.appendChild(option);
      };

      selectCameraPOV.oninput = () => {
        const radius = this.frame3D.camera.position.distanceTo(
          this.orbitControls.target
        );
        this.frame3D.camera.position.copy(this.orbitControls.target);
        buffer.get(selectCameraPOV.selectedOptions[0].value)(radius);
        this.frame3D.camera.updateMatrixWorld();
        this.orbitControls.update();
      };

      addOption('+X', (radius) => {
        this.frame3D.camera.position.x += radius;
      });
      addOption('-X', (radius) => {
        this.frame3D.camera.position.x -= radius;
      });
      addOption('+Y', (radius) => {
        this.frame3D.camera.position.y += radius;
      });
      addOption('-Y', (radius) => {
        this.frame3D.camera.position.y -= radius;
      });
      addOption('+Z', (radius) => {
        this.frame3D.camera.position.z += radius;
      });
      addOption('-Z', (radius) => {
        this.frame3D.camera.position.z -= radius;
      });
    }

    // collider object3d
    /** @type {Object3D} */
    this.colliderParent = new Object3D();
    this.colliderParent.name = 'colliderParent';
    this.frame3D.scene.add(this.colliderParent);

    this.gameObjectInput.addEventListener(
      GameObject3DInput.EVENT.SHAPE_ADDED,
      (event) => {
        this.updateCollider();
        this.selectShape(event.detail.shapeIndexCreated);
      }
    );

    /** @type {object} */
    this.shapeContext = {
      mesh: null,
      deleteButton: null,
      radiusUI: null,
      pointMesh: null,
    };
    this.pointsParent = new Object3D();
    {
      this.frame3D.scene.add(this.pointsParent);

      const raycaster = new Raycaster();
      window.addEventListener('keydown', (event) => {
        if (event.key == 'Escape') this.selectShape(-1);
        else if (event.key == 'Delete' && this.shapeContext.pointMesh) {
          if (
            this.shapeContext.pointMesh.userData.shapeJSON.points.length < 5
          ) {
            alert('a polygon must have at least 4 points');
          } else {
            // delete this point
            this.shapeContext.pointMesh.userData.shapeJSON.points.splice(
              this.shapeContext.pointMesh.userData.index,
              1
            );
            this.updateShapeSelected();
          }
        }
      });
      this.frame3D.domElementWebGL.addEventListener('click', (event) => {
        const mouse = new Vector2(
          (event.clientX / this.frame3D.domElementWebGL.clientWidth) * 2 - 1,
          -(event.clientY / this.frame3D.domElementWebGL.clientHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, this.frame3D.camera);

        if (!this.shapeContext.mesh) {
          // look for intersect with shape mesh
          const intersects = raycaster.intersectObject(
            this.colliderParent,
            true
          );
          if (intersects.length) {
            const index = this.colliderParent.children.indexOf(
              intersects[0].object
            );
            this.selectShape(index);
          }
        } else {
          if (event.ctrlKey) {
            // add a point
            const intersects = raycaster.intersectObject(
              this.gameObjectInput.gameObject3D,
              true
            );
            if (intersects.length) {
              const point = intersects[0].point;
              const index = this.colliderParent.children.indexOf(
                this.shapeContext.mesh
              );
              const colliderComp =
                this.gameObjectInput.gameObject3D.getComponent(
                  ColliderComponent.TYPE
                );
              // in gameobject referential
              const invMatrixWorld = this.pointsParent.matrixWorld
                .clone()
                .invert();
              point.applyMatrix4(invMatrixWorld);

              colliderComp.model.shapesJSON[index].points.push({
                x: point.x,
                y: point.y,
                z: point.z,
              });
              this.updateShapeSelected();
            }
          } else {
            // look for intersect with points shape
            const intersects = raycaster.intersectObject(
              this.pointsParent,
              true
            );
            if (intersects.length) {
              this.selectPointMesh(intersects[0].object);
            }
          }
        }
      });
    }
  }

  /**
   *
   * @param {object} gameObject3D - a game object
   */
  setCurrentGameObject3D(gameObject3D) {
    console.log('editor open ', gameObject3D);
    if (this.currentGameObject3D) {
      this.currentGameObject3D.removeFromParent();
    }

    this.currentGameObject3D = gameObject3D;

    // init render gameobject3d
    this.currentGameObject3D.traverse((child) => {
      if (!child.isGameObject3D) return;
      child.matrixAutoUpdate = true; // disable .static optimization

      const renderComp = child.getComponent(RenderComponent.TYPE);
      if (renderComp) {
        renderComp.initController(
          new RenderController(renderComp.getModel(), child, this.assetManager)
        );
      }
    });

    this.frame3D.scene.add(this.currentGameObject3D);

    const createGameObject3DUI = (go, indent = 0) => {
      if (!go.isGameObject3D) return null;

      let result = null;

      const hasChildrenGameObject =
        go.children.filter((el) => el.isGameObject3D).length != 0;
      const _this = this;

      if (hasChildrenGameObject) {
        result = document.createElement('details');
        const summary = document.createElement('summary');
        summary.classList.add('editor_clickable');
        summary.innerText = go.name;
        this.gameObjectInput.addEventListener(
          GameObject3DInput.EVENT.NAME_CHANGED,
          () => {
            summary.innerText = go.name;
          }
        );

        result.style.marginLeft = 10 * indent + 'px';
        result.appendChild(summary);

        summary.onclick = function (event) {
          if (this == event.target) {
            _this.selectGameObject3D(go);
          }
        };

        indent++;
        go.children.forEach((child) => {
          const childResult = createGameObject3DUI(child, indent);
          if (!childResult) return;
          result.appendChild(childResult);
        });
      } else {
        result = document.createElement('div');
        result.classList.add('editor_clickable');
        result.innerText = go.name;
        this.gameObjectInput.addEventListener(
          GameObject3DInput.EVENT.NAME_CHANGED,
          () => {
            result.innerText = go.name;
          }
        );

        result.style.marginLeft = 20 * indent + 'px';
        result.onclick = function (event) {
          if (this == event.target) {
            _this.selectGameObject3D(go);
          }
        };
      }

      return result;
    };

    while (this.currentGODomelement.firstChild) {
      this.currentGODomelement.firstChild.remove();
    }
    this.currentGODomelement.appendChild(
      createGameObject3DUI(this.currentGameObject3D)
    );

    this.selectGameObject3D(this.currentGameObject3D);

    // move camera to fit the scene
    const bb = Editor.computeBox3GameObject3D(this.currentGameObject3D);
    const center = new Vector3();
    bb.getCenter(center);
    cameraFitRectangle(
      this.frame3D.camera,
      bb.min,
      bb.max,
      this.currentGameObject3D.position.z
    );
    this.setOrbitControlsTargetTo(this.currentGameObject3D);
  }

  /**
   *
   * @param {Object3D} obj
   */
  setOrbitControlsTargetTo(obj) {
    const bb = Editor.computeBox3GameObject3D(obj);
    const center = new Vector3();
    bb.getCenter(center);
    this.orbitControls.target.copy(center);
    this.orbitControls.update();
  }

  selectGameObject3D(go) {
    if (go == this.gameObjectInput.gameObject3D) return;
    // game input dom element
    this.gameObjectInput.setGameObject3D(go);
    // bind
    this.buttonTargetGameObject3D.onclick = this.setOrbitControlsTargetTo.bind(
      this,
      go
    );
    this.transformControls.attach(go);
    this.updateBox3();
    this.updateCollider();
  }

  updateCollider() {
    for (let i = this.colliderParent.children.length - 1; i >= 0; i--) {
      this.colliderParent.children[i].removeFromParent();
    }
    this.selectShape(-1);

    /** @type {GameObject3D} */
    const go = this.gameObjectInput.gameObject3D;

    const colliderComp = go.getComponent(ColliderComponent.TYPE);
    if (colliderComp) {
      const worldPosition = new Vector3();
      const worldQuaternion = new Quaternion();
      const worldScale = new Vector3();

      go.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

      this.colliderParent.position.copy(worldPosition);
      this.colliderParent.quaternion.copy(worldQuaternion);
      this.colliderParent.scale.copy(worldScale);

      colliderComp.model.shapesJSON.forEach((shape) => {
        let geometry = null;

        switch (shape.type) {
          case ColliderComponent.SHAPE_TYPE.CIRCLE:
            geometry = new CircleGeometry(shape.radius, 32);
            geometry.translate(shape.center.x, shape.center.y, shape.center.z);
            break;
          case ColliderComponent.SHAPE_TYPE.POLYGON:
            geometry = new ConvexGeometry(
              shape.points.map((el) => new Vector3(el.x, el.y, el.z))
            );
            break;
          default:
            throw new Error('unknown shape type');
        }
        this.colliderParent.add(new Mesh(geometry, COLLIDER_MATERIAL));
      });
    }

    console.log('editor collider updated ');
  }

  selectShape(shapeIndex) {
    console.trace('shape select ', shapeIndex);

    // reset state
    if (this.shapeContext.mesh) {
      this.shapeContext.mesh.material = COLLIDER_MATERIAL;
      this.shapeContext.mesh = null;
    }
    if (this.shapeContext.deleteButton) {
      this.shapeContext.deleteButton.remove();
      this.shapeContext.deleteButton = null;
    }
    if (this.shapeContext.radiusUI) {
      this.shapeContext.radiusUI.parent.remove();
      this.shapeContext.radiusUI = null;
    }
    this.shapeContext.pointMesh = null;

    for (let i = this.pointsParent.children.length - 1; i >= 0; i--) {
      this.pointsParent.children[i].removeFromParent();
    }

    // assign new index
    this.shapeContext.mesh = this.colliderParent.children[shapeIndex];

    // set new stateContext state
    if (this.shapeContext.mesh) {
      this.setOrbitControlsTargetTo(this.shapeContext.mesh);
      this.shapeContext.mesh.material = COLLIDER_MATERIAL_SELECTED;

      const colliderComp = this.gameObjectInput.gameObject3D.getComponent(
        ColliderComponent.TYPE
      );

      this.shapeContext.deleteButton = document.createElement('button');
      this.shapeContext.deleteButton.innerText = 'delete shape';
      this.shapeContext.deleteButton.onclick = () => {
        colliderComp.model.shapesJSON.splice(shapeIndex, 1);
        this.updateCollider();
      };

      if (
        colliderComp.model.shapesJSON[shapeIndex].type ==
        ColliderComponent.SHAPE_TYPE.CIRCLE
      ) {
        // add ui to set radius
        this.shapeContext.radiusUI = createLabelInput('Radius ', 'number');
        this.gameObjectInput.detailsCollider.appendChild(
          this.shapeContext.radiusUI.parent
        );

        // init
        this.shapeContext.radiusUI.input.value =
          colliderComp.model.shapesJSON[shapeIndex].radius;

        this.shapeContext.radiusUI.input.onchange = () => {
          const newRadius = this.shapeContext.radiusUI.input.valueAsNumber;
          if (newRadius < 0.01) {
            alert('radius must superior at 0.01');
          } else {
            colliderComp.model.shapesJSON[shapeIndex].radius = newRadius;
            this.updateShapeSelected();
          }
        };
      }

      this.gameObjectInput.detailsCollider.appendChild(
        this.shapeContext.deleteButton
      );

      this.updateShapeSelected(false); // no need to rebuild shape geometry
    } else {
      this.transformControls.attach(this.gameObjectInput.gameObject3D);
    }
  }

  selectPointMesh(mesh) {
    this.shapeContext.pointMesh = mesh;
    this.transformControls.attach(this.shapeContext.pointMesh);
  }

  updateShapeSelected(rebuildShapeGeometry = true) {
    // remove all old point meshes
    for (let i = this.pointsParent.children.length - 1; i >= 0; i--) {
      this.pointsParent.children[i].removeFromParent();
    }

    // reset transform controls
    this.transformControls.detach();

    // unreference this.shapeContext.pointMesh
    this.shapeContext.pointMesh = null;

    // transform pointParent in referential of the current gameobject3D
    const worldPosition = new Vector3();
    const worldQuaternion = new Quaternion();
    const worldScale = new Vector3();
    this.gameObjectInput.gameObject3D.matrixWorld.decompose(
      worldPosition,
      worldQuaternion,
      worldScale
    );

    this.pointsParent.position.copy(worldPosition);
    this.pointsParent.quaternion.copy(worldQuaternion);
    this.pointsParent.scale.copy(worldScale);

    // retrieve shapeJSON
    const colliderComp = this.gameObjectInput.gameObject3D.getComponent(
      ColliderComponent.TYPE
    );
    const index = this.colliderParent.children.indexOf(this.shapeContext.mesh);
    const shapeJSON = colliderComp.model.shapesJSON[index];

    // rebuild shape + point mesh
    if (shapeJSON.type == ColliderComponent.SHAPE_TYPE.POLYGON) {
      if (rebuildShapeGeometry) {
        this.shapeContext.mesh.geometry = new ConvexGeometry(
          shapeJSON.points.map((el) => new Vector3(el.x, el.y, el.z))
        );
        console.trace('shape rebuilded with ', shapeJSON);
      }

      shapeJSON.points.forEach((point, index) => {
        const pointMesh = new Mesh(
          new SphereGeometry(),
          COLLIDER_POINT_MATERIAL
        );
        pointMesh.position.set(point.x, point.y, point.z);
        pointMesh.userData.index = index;
        pointMesh.userData.shapeJSON = shapeJSON; // userdata used at the end of transform controls
        this.pointsParent.add(pointMesh);
      });
    } else if (shapeJSON.type == ColliderComponent.SHAPE_TYPE.CIRCLE) {
      if (rebuildShapeGeometry) {
        this.shapeContext.mesh.geometry = new CircleGeometry(
          shapeJSON.radius,
          32
        );
        this.shapeContext.mesh.geometry.translate(
          shapeJSON.center.x,
          shapeJSON.center.y,
          shapeJSON.center.z
        );
        console.trace('shape rebuilded with ', shapeJSON);
      }
      const pointMesh = new Mesh(new SphereGeometry(), COLLIDER_POINT_MATERIAL);
      pointMesh.position.set(
        shapeJSON.center.x,
        shapeJSON.center.y,
        shapeJSON.center.z
      );
      pointMesh.userData.shapeJSON = shapeJSON; // userdata used at the end of transform controls
      this.pointsParent.add(pointMesh);
      this.selectPointMesh(pointMesh);
    }
  }

  updateBox3() {
    this.gameObjectInput.gameObject3D.updateMatrixWorld();
    const worldQuaternion = new Quaternion();
    this.gameObjectInput.gameObject3D.matrixWorld.decompose(
      new Vector3(),
      worldQuaternion,
      new Vector3()
    );

    const inverseWorldQuaternion = worldQuaternion.clone().invert();

    // cancel quaternion
    this.gameObjectInput.gameObject3D.quaternion.multiply(
      inverseWorldQuaternion
    );

    const bbScale = Editor.computeBox3GameObject3D(
      this.gameObjectInput.gameObject3D
    );
    this.currentGameObjectMeshBox3.scale.copy(
      bbScale.max.clone().sub(bbScale.min)
    );

    // restore quaternion
    this.gameObjectInput.gameObject3D.quaternion.multiply(worldQuaternion);

    const bbPosition = Editor.computeBox3GameObject3D(
      this.gameObjectInput.gameObject3D
    );
    bbPosition.getCenter(this.currentGameObjectMeshBox3.position);

    this.currentGameObjectMeshBox3.quaternion.copy(worldQuaternion);
    this.currentGameObjectMeshBox3.updateMatrixWorld();
  }

  static computeBox3GameObject3D(obj) {
    const bb = new Box3().setFromObject(obj);

    // avoid bug if no renderdata on this gameobject
    const checkIfCoordInfinite = function (value) {
      return value === Infinity || value === -Infinity;
    };
    const checkIfVectorHasCoordInfinite = function (vector) {
      return (
        checkIfCoordInfinite(vector.x) ||
        checkIfCoordInfinite(vector.y) ||
        checkIfCoordInfinite(vector.z)
      );
    };

    if (
      checkIfVectorHasCoordInfinite(bb.min) ||
      checkIfVectorHasCoordInfinite(bb.max)
    ) {
      // cube 1,1,1
      bb.min.set(-0.5, -0.5, -0.5);
      bb.max.set(0.5, 0.5, 0.5);

      bb.applyMatrix4(obj.matrixWorld);
    }
    return bb;
  }
}

class GameObject3DInput extends HTMLElement {
  constructor(idRenderDatas, idSounds) {
    super();

    /** @type {Array} */
    this.idRenderDatas = idRenderDatas;

    /** @type {Array} */
    this.idSounds = idSounds;

    /** @type {GameObject3D|null} */
    this.gameObject3D = null;

    // Name
    this.name = createLabelInput('Name: ', 'text');
    this.appendChild(this.name.parent);

    this.name.input.onchange = () => {
      this.gameObject3D.name = this.name.input.value;
      this.dispatchEvent(new CustomEvent(GameObject3DInput.EVENT.NAME_CHANGED));
    };

    // Static
    this.static = createLabelInput('Static: ', 'checkbox');
    this.appendChild(this.static.parent);

    this.static.input.onchange = () => {
      this.gameObject3D.static = this.static.input.checked;
    };

    // transform
    const detailsTransform = document.createElement('details');
    this.appendChild(detailsTransform);
    const summaryTransform = document.createElement('summary');
    summaryTransform.innerText = 'Transform';
    detailsTransform.appendChild(summaryTransform);

    this.position = new Vector3Input('Position', 0.1);
    detailsTransform.appendChild(this.position);

    this.rotation = new Vector3Input('Rotation', 0.01);
    detailsTransform.appendChild(this.rotation);

    this.scale = new Vector3Input('Scale', 0.1);
    detailsTransform.appendChild(this.scale);

    this.position.addEventListener('change', () => {
      this.gameObject3D.position.set(
        this.position.x.input.valueAsNumber,
        this.position.y.input.valueAsNumber,
        this.position.z.input.valueAsNumber
      );
    });
    this.rotation.addEventListener('change', () => {
      this.gameObject3D.rotation.set(
        this.rotation.x.input.valueAsNumber,
        this.rotation.y.input.valueAsNumber,
        this.rotation.z.input.valueAsNumber
      );
    });
    this.scale.addEventListener('change', () => {
      this.gameObject3D.scale.set(
        this.scale.x.input.valueAsNumber,
        this.scale.y.input.valueAsNumber,
        this.scale.z.input.valueAsNumber
      );
    });

    // collider
    this.detailsCollider = document.createElement('details');
    this.appendChild(this.detailsCollider);

    // render
    this.detailsRender = document.createElement('details');
    this.appendChild(this.detailsRender);

    // audio
    this.detailsAudio = document.createElement('details');
    this.appendChild(this.detailsAudio);
  }

  /**
   *
   * @param {GameObject3D} go
   */
  setGameObject3D(go) {
    this.gameObject3D = go;

    this.name.input.value = go.name;

    this.static.input.checked = go.static;

    // transform
    this.updateTransform();

    // collider
    this.updateCollider();

    // render
    this.updateRender();

    // audio
    this.updateAudio();
  }

  updateAudio() {
    const audioComp = this.gameObject3D.getComponent(AudioComponent.TYPE);
    this.detailsAudio.hidden = !audioComp;
    if (audioComp) {
      while (this.detailsAudio.firstChild)
        this.detailsAudio.firstChild.remove();

      // rebuild domelement
      const summaryAudio = document.createElement('summary');
      summaryAudio.innerText = 'Audio';
      this.detailsAudio.appendChild(summaryAudio);

      // sounds
      const listIdSounds = document.createElement('ul');
      this.detailsAudio.appendChild(listIdSounds);

      const updateList = () => {
        while (listIdSounds.firstChild) listIdSounds.firstChild.remove();

        audioComp.model.soundsJSON.forEach((idSound) => {
          const li = document.createElement('li');
          li.innerText = idSound;
          listIdSounds.appendChild(li);

          const deleteButton = document.createElement('button');
          deleteButton.innerText = 'delete';
          li.appendChild(deleteButton);

          deleteButton.onclick = () => {
            removeFromArray(audioComp.model.soundsJSON, idSound);
            updateList();
          };
        });
      };
      updateList();

      // sounds
      const selectIdSound = document.createElement('select');
      this.detailsAudio.appendChild(selectIdSound);
      this.idSounds.forEach((idSound) => {
        const option = document.createElement('option');
        option.value = idSound;
        option.innerText = idSound;
        selectIdSound.appendChild(option);
      });

      const addIdSound = document.createElement('button');
      this.detailsAudio.appendChild(addIdSound);
      addIdSound.innerText = 'Add sound';
      addIdSound.onclick = () => {
        if (
          arrayPushOnce(
            audioComp.model.soundsJSON,
            selectIdSound.selectedOptions[0].value
          )
        ) {
          // has been added
          updateList();
        }
      };

      // conf audio

      // loop
      const loop = createLabelInput('Loop: ', 'checkbox');
      this.detailsAudio.appendChild(loop.parent);
      loop.input.checked = audioComp.model.conf.loop;
      loop.input.onchange = () => {
        audioComp.model.conf.loop = loop.input.checked;
      };

      // autoplay
      const autoplay = createLabelInput('Autoplay: ', 'checkbox');
      this.detailsAudio.appendChild(autoplay.parent);
      autoplay.input.checked = audioComp.model.conf.autoplay;
      autoplay.input.onchange = () => {
        audioComp.model.conf.autoplay = autoplay.input.checked;
      };

      // spatialized
      const spatialized = createLabelInput('Spatialized: ', 'checkbox');
      this.detailsAudio.appendChild(spatialized.parent);
      spatialized.input.checked = audioComp.model.conf.spatialized;
      spatialized.input.onchange = () => {
        audioComp.model.conf.spatialized = spatialized.input.checked;
      };

      // volume
      const volume = createLabelInput('Volume: ', 'range');
      this.detailsAudio.appendChild(volume.parent);
      volume.input.min = 0;
      volume.input.max = 1;
      volume.input.step = 'any';
      volume.input.value = isNaN(audioComp.model.conf.volume)
        ? 1
        : audioComp.model.conf.volume;
      volume.input.onchange = () => {
        audioComp.model.conf.volume = volume.input.valueAsNumber;
      };
    }
  }

  updateRender() {
    const renderComp = this.gameObject3D.getComponent(RenderComponent.TYPE);
    this.detailsRender.hidden = !renderComp;
    if (renderComp) {
      while (this.detailsRender.firstChild)
        this.detailsRender.firstChild.remove();

      // rebuild domelement
      const summaryRender = document.createElement('summary');
      summaryRender.innerText = 'Render';
      this.detailsRender.appendChild(summaryRender);

      // color
      const color = createLabelInput('Couleur: ', 'color');
      this.detailsRender.appendChild(color.parent);
      color.input.value =
        '#' + new Color().fromArray(renderComp.model.color).getHexString();

      // opacity
      const opacity = createLabelInput('Opacité ', 'range');
      opacity.input.min = 0;
      opacity.input.max = 1;
      opacity.input.step = 'any';
      this.detailsRender.appendChild(opacity.parent);
      opacity.input.value = renderComp.model.color[3];

      const updateColor = () => {
        renderComp.controller.setColor([
          ...new Color(color.input.value).toArray(),
          opacity.input.valueAsNumber,
        ]);
      };

      opacity.input.onchange = updateColor;

      color.input.onchange = updateColor;

      // id model
      const selectIdRenderData = document.createElement('select');
      this.detailsRender.appendChild(selectIdRenderData);
      this.idRenderDatas.forEach((id) => {
        const option = document.createElement('option');
        option.innerText = id;
        option.value = id;
        selectIdRenderData.appendChild(option);
        if (renderComp.model.idRenderData == id) {
          selectIdRenderData.value = id;
        }
      });

      selectIdRenderData.onchange = () => {
        renderComp.controller.setIdRenderData(
          selectIdRenderData.selectedOptions[0].value
        );
      };
    }
  }

  updateCollider() {
    const colliderComp = this.gameObject3D.getComponent(ColliderComponent.TYPE);
    this.detailsCollider.hidden = !colliderComp;
    if (colliderComp) {
      while (this.detailsCollider.firstChild)
        this.detailsCollider.firstChild.remove();

      // rebuild domelement
      const summaryCollider = document.createElement('summary');
      summaryCollider.innerText = 'Collider';
      this.detailsCollider.appendChild(summaryCollider);

      // edit body attr
      const bodyCheckbox = createLabelInput('body', 'checkbox');
      bodyCheckbox.input.checked = colliderComp.model.body;
      bodyCheckbox.input.onchange = () =>
        (colliderComp.model.body = bodyCheckbox.input.checked);
      this.detailsCollider.appendChild(bodyCheckbox.parent);

      // add a polygon
      const addPolygonButton = document.createElement('button');
      addPolygonButton.innerText = 'Add Polygon';
      this.detailsCollider.appendChild(addPolygonButton);

      addPolygonButton.onclick = () => {
        // add a square
        colliderComp.model.shapesJSON.push({
          type: ColliderComponent.SHAPE_TYPE.POLYGON,
          points: [
            { x: -5, y: -5, z: 0 },
            { x: 5, y: -5, z: 0 },
            { x: 5, y: 5, z: 0 },
            { x: -5, y: 5, z: 0 },
          ],
        });
        this.dispatchEvent(
          new CustomEvent(GameObject3DInput.EVENT.SHAPE_ADDED, {
            detail: {
              shapeIndexCreated: colliderComp.model.shapesJSON.length - 1,
            },
          })
        );
      };

      // add a circle
      const addCircleButton = document.createElement('button');
      addCircleButton.innerText = 'Add Circle';
      this.detailsCollider.appendChild(addCircleButton);

      addCircleButton.onclick = () => {
        // add a circle
        colliderComp.model.shapesJSON.push({
          type: ColliderComponent.SHAPE_TYPE.CIRCLE,
          radius: 2.5,
          center: { x: 0, y: 0, z: 0 },
        });
        this.dispatchEvent(
          new CustomEvent(GameObject3DInput.EVENT.SHAPE_ADDED, {
            detail: {
              shapeIndexCreated: colliderComp.model.shapesJSON.length - 1,
            },
          })
        );
      };

      const visualization2DImage = document.createElement('img');
      this.detailsCollider.appendChild(visualization2DImage);

      // visualize collision in 2d
      const visualizeCollision2DButton = document.createElement('button');
      visualizeCollision2DButton.innerText = 'Update visualize 2D collision';
      this.detailsCollider.appendChild(visualizeCollision2DButton);
      const drawVisualization2D = () => {
        const scene = new Scene();
        scene.add(new AmbientLight('white', 0.6));

        // move gameobject to another scene
        const oldParent = this.gameObject3D.parent;
        this.gameObject3D.removeFromParent();

        scene.add(this.gameObject3D);
        this.gameObject3D.updateMatrixWorld();

        // compute bb with collider points
        const bb = new Box3();

        const colliderComp = this.gameObject3D.getComponent(
          ColliderComponent.TYPE
        );
        colliderComp.model.shapesJSON.forEach((shape) => {
          if (shape.type == ColliderComponent.SHAPE_TYPE.POLYGON) {
            shape.points.forEach((point) => {
              bb.expandByPoint(
                new Vector3(point.x, point.y, point.z).applyMatrix4(
                  this.gameObject3D.matrixWorld
                )
              );
            });
          } else {
            bb.expandByPoint(
              new Vector3(
                shape.center.x + shape.center.x,
                shape.center.y + shape.center.y,
                shape.center.z + shape.center.z
              ).applyMatrix4(this.gameObject3D.matrixWorld)
            );
            bb.expandByPoint(
              new Vector3(
                shape.center.x - shape.center.x,
                shape.center.y - shape.center.y,
                shape.center.z - shape.center.z
              ).applyMatrix4(this.gameObject3D.matrixWorld)
            );
          }
        });

        const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
        const halfSize = maxDim * 0.5;
        const camera = new OrthographicCamera(
          -halfSize,
          halfSize,
          halfSize,
          -halfSize,
          0.001,
          10000
        );
        bb.getCenter(camera.position);
        camera.position.z = 1000;
        camera.updateProjectionMatrix();
        const renderer = new WebGLRenderer({
          canvas: document.createElement('canvas'),
          antialias: true,
          alpha: true,
        });

        const size = 512;

        renderer.setSize(size, size);
        renderer.setClearColor(0xffffff, 0);
        renderer.render(scene, camera);

        // compute offset to translate collisions after
        const offset = bb
          .getCenter(new Vector3())
          .sub(this.gameObject3D.position);

        this.gameObject3D.removeFromParent();
        oldParent.add(this.gameObject3D);

        // draw image
        const image = new Image();
        image.src = renderer.domElement.toDataURL();

        image.onload = async () => {
          // render collisions
          const json = this.gameObject3D.toJSON();
          delete json.children; // remove children (they should be removed also in rendering above ?)
          delete json.components.GameScript; // remove GameScript only Collider is needed
          const context = new Context({}, new GameObject3D(json));
          await context.load();

          const canvas2D = document.createElement('canvas');
          canvas2D.width = renderer.domElement.width;
          canvas2D.height = renderer.domElement.height;
          const ctx = canvas2D.getContext('2d');

          ctx.drawImage(image, 0, 0);

          ctx.save();
          ctx.translate(
            (0.5 - offset.x / maxDim) * renderer.domElement.width,
            (0.5 + offset.y / maxDim) * renderer.domElement.height
          );
          ctx.scale(
            renderer.domElement.width / maxDim,
            -renderer.domElement.height / maxDim
          );
          context.collisions.draw(ctx);
          ctx.fillStyle = 'green';
          ctx.fill();
          ctx.restore();

          visualization2DImage.src = canvas2D.toDataURL();
        };
      };
      visualizeCollision2DButton.onclick = drawVisualization2D;
      drawVisualization2D();
    }
  }

  updateTransform() {
    this.position.x.input.value = this.gameObject3D.position.x;
    this.position.y.input.value = this.gameObject3D.position.y;
    this.position.z.input.value = this.gameObject3D.position.z;
    this.rotation.x.input.value = this.gameObject3D.rotation.x;
    this.rotation.y.input.value = this.gameObject3D.rotation.y;
    this.rotation.z.input.value = this.gameObject3D.rotation.z;
    this.scale.x.input.value = this.gameObject3D.scale.x;
    this.scale.y.input.value = this.gameObject3D.scale.y;
    this.scale.z.input.value = this.gameObject3D.scale.z;
  }

  static get EVENT() {
    return {
      NAME_CHANGED: 'name_changed',
      SHAPE_ADDED: 'polygon_added',
    };
  }
}
window.customElements.define('transform-input', GameObject3DInput); // mandatory to extends HTMLElement