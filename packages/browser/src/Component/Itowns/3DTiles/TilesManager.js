import { Tile } from './Model/Tile.js';
import { getVisibleTiles, updateITownsView } from './3DTilesUtils.js';
import {
  CityObjectID,
  CityObject,
  createCityObjectID,
} from './Model/CityObject.js';
import { CityObjectStyle } from './Model/CityObjectStyle.js';
import { StyleManager } from './StyleManager.js';
import { EventSender } from '@ud-viz/shared';
import { focusCameraOn } from '../Component/Component';

/**
 * @class Manages the tiles and the style for city objects.
 */
export class TilesManager extends EventSender {
  /**
   * Creates a new TilesManager from an iTowns view and the 3DTiles layer.
   *
   * @param {import('itowns').View} view The iTowns view.
   * @param {import('itowns').C3DTilesLayer} layer The 3DTiles layer.
   */
  constructor(view, layer) {
    super();
    /**
     * The iTowns view.
     */
    this.view = view;

    /**
     * The 3DTiles layer.
     */
    this.layer = layer;

    /**
     * The total number of tiles in the scene.
     *
     * @type {number}
     */
    this.totalTileCount = 0;

    if (this.layer.tileset !== undefined) {
      this.totalTileCount = this.layer.tileset.tiles.length;
    }

    /**
     * The number of tiles currently loaded by the tile manager. If this number
     * is equal to `totalTileCount`, no more `update` is necessary.
     *
     * @type {number}
     */
    this.loadedTileCount = 0;

    /**
     * The color used for tiles default style.
     *
     * @type {number}
     */
    this.color = null;

    /**
     * The set of tile wrappers that have been loaded.
     *
     * @type {Array<Tile>}
     */
    this.tiles = [];
    if (this.totalTileCount !== 0) {
      // Load existing tiles
      const tiles = getVisibleTiles(this.layer);
      for (const tile of tiles) {
        if (this.tiles[tile.tileId] === undefined) {
          this.tiles[tile.tileId] = new Tile(this.layer, tile.tileId);
          this.tiles[tile.tileId].loadCityObjects();
          this.loadedTileCount += 1;
        }
      }
    }

    // /// EVENTS
    // /////////
    // Add listener to the 3D Tiles layer for tile loading
    this.layer.onTileContentLoaded = this.loadTile.bind(this);
    // Create an event where a module can add a callback. Fired in
    // this.loadTile().
    this.registerEvent(TilesManager.EVENT_TILE_LOADED);

    // /// STYLE
    // /////////

    /**
     * Manages the styles of the city objects.
     *
     * @type {StyleManager}
     */
    this.styleManager = new StyleManager();

    /**
     * Keep tracks of the update of tiles. Associate each tile with the UUID of
     * their Object3D during the last update.
     *
     * @type {Object<number, string>}
     */
    this.upToDateTileIds = {};

    /**
     * Set to true if the tileset has an unique default color
     *
     * @type {boolean}
     */
    this.hasDefaultColor = false;
  }

  /**
   * Load a tile by creating the CityObjects and applying the style to the tile
   *
   * @param {Tile} tile The tile to load
   */
  loadTile(tile) {
    // Update the totalTileCount.
    // TODO: this should be managed with an event: when the tileset is
    //  loaded (i.e. tileIndex filled), then totalTileCount should be set.
    this.totalTileCount = this.layer.tileset.tiles.length;
    // Set the style for the whole tileset
    if (
      this.color !== null &&
      !this.styleManager.isStyleRegistered('default')
    ) {
      this.registerStyle('default', {
        materialProps: { opacity: 1, color: this.color },
      });
      this.hasDefaultColor = true;
    }

    // Verifies that the tile has not been already added (might be removed
    // when tile unloading will be managed)
    if (this.tiles[tile.tileId] === undefined) {
      this.tiles[tile.tileId] = new Tile(this.layer, tile.tileId);
      this.tiles[tile.tileId].loadCityObjects(this);
      this.loadedTileCount += 1;
    }
    // Callback when a tile is loaded.
    // TODO: Les tuiles d'iTowns devraient etre rendues invisibles plutot
    //  que d'etre déchargées et rechargées. A ce moment là, ce callback
    //  pourra etre dans le if ci dessus

    // Actually if the app is dealing with a large extent like the earth the unloading process is required
    // You can filter what tile to request in the itowns.process3dTilesNode with the culling function to decide what to load and unload
    // the default load what is on screen and unload what is not

    if (this.color) this.setStyleToTile(tile.tileId, 'default');
    else this.setDefaultStyleToTile(tile.tileId);
    this.applyStyleToTile(tile.tileId, { updateView: false });
    this.sendEvent(TilesManager.EVENT_TILE_LOADED, tile);
  }

  /**
   * Focus the camera on the 3D Tiles layer
   */
  focusCamera() {
    if (this.layer.isC3DTilesLayer) {
      const coordinates = this.view.camera.position();
      const extent = this.layer.extent;
      coordinates.x = (extent.east + extent.west) / 2;
      coordinates.y = (extent.north + extent.south) / 2;
      coordinates.z = 200;
      if (this.layer.tileset.tiles[0])
        coordinates.z = this.layer.tileset.tiles[0].boundingVolume.box.max.z;
      focusCameraOn(this.view, this.view.controls, coordinates, {
        verticalDistance: 200,
        horizontalDistance: 200,
      });
    }
  }

  /**
   * Returns the city object, if the tile is loaded.
   *
   * @param {CityObjectID} cityObjectId The city object identifier.
   * @returns {CityObject} The CityObject with the corresponding ID
   */
  getCityObject(cityObjectId) {
    if (this.tiles[cityObjectId.tileId] === undefined) {
      return undefined;
    }

    if (!(cityObjectId instanceof CityObjectID)) {
      cityObjectId = createCityObjectID(cityObjectId);
    }

    return this.tiles[cityObjectId.tileId].cityObjects[cityObjectId.batchId];
  }

  /**
   * @callback predicateCB
   * @param {CityObject} cityObject
   * @returns {boolean}
   */

  /**
   * Search and returns the first city object that matches the given predicate.
   * If no city object matches the predicate, `undefined` is returned.
   *
   * @param {predicateCB} predicate The predicate to
   * determine the city object.
   * @returns {CityObject | undefined} The first city object that matches the
   * predicate, or `undefined` if no city object is found.
   */
  findCityObject(predicate) {
    for (const tile of Object.values(this.tiles)) {
      for (const cityObject of tile.cityObjects) {
        if (predicate(cityObject)) {
          return cityObject;
        }
      }
    }
    return undefined;
  }

  /**
   * Search and returns all city objects that matches the given predicate.
   *
   * @param {predicateCB} predicate The predicate to
   * determine the city objects.
   * @returns {Array<CityObject>} An array of all the city object that matches
   * the predicate.
   */
  findAllCityObjects(predicate) {
    const results = [];
    for (const tile of Object.values(this.tiles)) {
      for (const cityObject of tile.cityObjects) {
        if (predicate(cityObject)) {
          results.push(cityObject);
        }
      }
    }
    return results;
  }

  /**
   * Sets the style of a particular city object.
   *
   * @param {CityObjectID | Array<CityObjectID>} cityObjectId The city object
   * identifier.
   * @param {CityObjectStyle | string} style The desired style.
   */
  setStyle(cityObjectId, style) {
    const tilesToUpdate = new Set();
    if (Array.isArray(cityObjectId)) {
      for (let i = 0; i < cityObjectId.length; i++) {
        if (!(cityObjectId[i] instanceof CityObjectID)) {
          cityObjectId[i] = createCityObjectID(cityObjectId[i]);
        }
        tilesToUpdate.add(cityObjectId[i].tileId);
      }
    } else {
      if (!(cityObjectId instanceof CityObjectID)) {
        cityObjectId = createCityObjectID(cityObjectId);
      }
      tilesToUpdate.add(cityObjectId.tileId);
    }
    this.styleManager.setStyle(cityObjectId, style);
    for (const tileId of tilesToUpdate) {
      this._markTileToUpdate(tileId);
    }
  }

  /**
   * Sets the style of a particular tile.
   *
   * @param {number} tileId The tile identifier.
   * @param {CityObjectStyle | string} style The desired style.
   */
  setStyleToTile(tileId, style) {
    if (this.tiles[tileId]) {
      for (const i in this.tiles[tileId].cityObjects) {
        this.setStyle(this.tiles[tileId].cityObjects[i].cityObjectId, style);
      }
    }
  }

  /**
   * Sets the style of a particular tile.
   *
   * @param {number} tileId The tile identifier.
   */
  setDefaultStyleToTile(tileId) {
    if (this.tiles[tileId]) {
      for (const i in this.tiles[tileId].cityObjects) {
        const cityObject = this.tiles[tileId].cityObjects[i];
        this.setStyle(cityObject.cityObjectId, cityObject.defaultStyleId);
      }
    }
  }

  /**
   * Sets the style for all the tileset
   *
   * @param {CityObjectStyle | string} style The desired style.
   */
  setStyleToTileset(style) {
    for (const tile in this.tiles) {
      this.setStyleToTile(tile, style);
    }
  }

  /**
   * Register a new or modify an existing registered style.
   *
   * @param {string} name A name to identify the style.
   * @param {CityObjectStyle} style The style to register.
   */
  registerStyle(name, style) {
    if (!(style instanceof CityObjectStyle)) {
      style = new CityObjectStyle(style);
    }
    const needUpdate = this.styleManager.registerStyle(name, style);
    if (needUpdate) {
      const usage = this.styleManager.getStyleUsage(name);
      for (const tileId of Object.keys(usage)) {
        this._markTileToUpdate(tileId);
      }
    }
  }

  /**
   * Check if a style is registered.
   *
   * @param {string} name Name of the style.
   * @returns {boolean} True if the style is registered, false either.
   */
  isStyleRegistered(name) {
    return this.styleManager.isStyleRegistered(name);
  }

  /**
   * Removes the style of a particular city object.
   *
   * @param {CityObjectID | Array<CityObjectID>} cityObjectId The city object
   * identifier.
   */
  removeStyle(cityObjectId) {
    const tilesToUpdate = new Set();

    if (Array.isArray(cityObjectId)) {
      for (let i = 0; i < cityObjectId.length; i++) {
        if (!(cityObjectId[i] instanceof CityObjectID)) {
          cityObjectId[i] = createCityObjectID(cityObjectId[i]);
        }
        tilesToUpdate.add(cityObjectId[i].tileId);
      }
    } else {
      if (!(cityObjectId instanceof CityObjectID)) {
        cityObjectId = createCityObjectID(cityObjectId);
      }
      tilesToUpdate.add(cityObjectId.tileId);
    }

    this.styleManager.removeStyle(cityObjectId);
    for (const tileId of tilesToUpdate) {
      this._markTileToUpdate(tileId);
    }
  }

  /**
   * Removes all styles for the given tile.
   *
   * @param {number} tileId The tile ID.
   */
  removeStyleFromTile(tileId) {
    this.styleManager.removeStyleFromTile(tileId);
    this._markTileToUpdate(tileId);
  }

  /**
   * Removes all styles currently registered.
   */
  removeAllStyles() {
    const tileIds = this.styleManager.getStyledTiles();
    this.styleManager.removeAllStyles();
    for (const tileId of tileIds) {
      this._markTileToUpdate(tileId);
    }
  }

  /**
   * Gets the style applied to a given object ID.
   *
   * @param {CityObjectID} cityObjectId The city object ID.
   * @returns {CityObjectStyle} The style corresponding to the ID
   */
  getStyleAppliedTo(cityObjectId) {
    if (!(cityObjectId instanceof CityObjectID)) {
      cityObjectId = createCityObjectID(cityObjectId);
    }
    return this.styleManager.getStyleAppliedTo(cityObjectId);
  }

  /**
   * Applies the current styles added with `setStyle` or `addStyle`.
   *
   * @param {object} options Options of the method.
   * @param {Function} [options.updateFunction] The function used to update the. () => any.
   * view. Default is `udpateITownsView(view, layer)`.
   */
  applyStyles(options = {}) {
    const updateFunction =
      options.updateFunction ||
      (() => {
        this.view.notifyChange();
      });
    for (const tile of this.tiles) {
      if (tile === undefined) {
        continue;
      }

      // Set to false so we update the view only once
      this.applyStyleToTile(tile.tileId, { updateView: false });
    }
    updateFunction();
  }

  /**
   * Apply the saved style to the tile given in parameter.
   *
   * @param {number} tileId The ID of the tile to apply the style to.
   * @param {object} options Options of the apply function.
   * @param {boolean} [options.updateView] Whether the view should update at the
   * end of the method. Default value is `true`.
   * @param {Function} [options.updateFunction] The function used to update the. () => any.
   * view. Default is `udpateITownsView(view, layer)`.
   */
  applyStyleToTile(tileId, options = {}) {
    const updateView =
      options.updateView !== undefined ? options.updateView : true;
    const updateFunction =
      options.updateFunction ||
      (() => {
        updateITownsView(this.view, this.layer);
      });

    const tile = this.tiles[tileId];
    if (tile === undefined) return;
    if (this._shouldTileBeUpdated(tile)) {
      this.styleManager.applyToTile(tile);
      this._markTileAsUpdated(tile);

      if (updateView) {
        updateFunction();
      }
    }
  }

  /**
   * Apply the default style to the whole tileset
   */
  setDefaultStyle() {
    if (this.color === null) {
      for (const tile of this.tiles) {
        if (tile !== undefined) {
          this.setDefaultStyleToTile(tile.tileId);
        }
      }
    } else this.setStyleToTileset('default');
  }

  /**
   * Sets the saved UUID of the tile, so that it should be updated in the next
   * `applyStyles` call.
   *
   * @private
   * @param {number} tileId The ID of the tile to update.
   */
  _markTileToUpdate(tileId) {
    this.upToDateTileIds[tileId] = undefined;
  }

  /**
   * Updates the saved UUID of the tile.
   *
   * @private
   * @param {Tile} tile The tile to mark.
   */
  _markTileAsUpdated(tile) {
    const object3d = tile.getObject3D();
    if (object3d === undefined) {
      throw 'The tile is not currently loaded and cannot be marked as updated.';
    }

    const uuid = object3d.uuid;
    this.upToDateTileIds[tile.tileId] = uuid;
  }

  /**
   * Checks if the style of the tile should be updated.
   *
   * @private
   * @param {Tile} tile The tile.
   * @returns {boolean} True if the style of the tile should be updated
   */
  _shouldTileBeUpdated(tile) {
    const object3d = tile.getObject3D();
    if (object3d === undefined) {
      // Tile is not visible, cannot be updated
      return false;
    }

    if (this.upToDateTileIds[tile.tileId] === undefined) {
      // Tile has not been updated yet, or has been marked to update
      return true;
    }

    const uuid = object3d.uuid;
    // If the current UUID is the same as the saved one, it means that the tile
    // has not been reloaded.
    return this.upToDateTileIds[tile.tileId] !== uuid;
  }

   /**
   * Returns the city objects which corresponds to a key,value pair in tilesManager
   * batch table.
   *
   * @param {string} batchTableKey The batch table key to search by.
   * @param {string} batchTableValue The batch table value to search for.
   * @returns {Array<import("../3DTiles/Model/CityObject").CityObject>} An array of picked CityObject
   */
  pickCityObjectsByBatchTable(batchTableKey, batchTableValue) {
    const cityObjects = [];

    for (const tile of this.tiles) {
      if (
        !tile ||
        !tile.cityObjects ||
        !tile.batchTable ||
        !tile.batchTable.content[batchTableKey] ||
        !tile.batchTable.content[batchTableKey].includes(batchTableValue)
      ) {
        continue;
      }
      cityObjects.push(
        tile.cityObjects[
          tile.batchTable.content[batchTableKey].indexOf(batchTableValue)
        ]
      );
    }

    if (cityObjects.length == 0) {
      console.warn(
        'WARNING: cityObjects not found with key, value pair: ' +
          batchTableKey +
          ', ' +
          batchTableValue
      );
    }
    return cityObjects;
  }

  // //////////
  // /// EVENTS
  static get EVENT_TILE_LOADED() {
    return 'EVENT_TILE_LOADED';
  }
}
