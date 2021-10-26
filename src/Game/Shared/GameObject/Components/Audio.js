/** @format */

const THREE = require('three');

/**
 *  Component used to handle the 3D Audio of the GameObject
 */
const AudioModule = class Audio {
  constructor(parent, json) {
    //gameobject of this component
    this.parent = parent;
    //uuid
    this.uuid = json.uuid || THREE.MathUtils.generateUUID();

    this.soundsJSON = json.sounds || [];
    this.sounds = {};

    this.conf = json.conf || {};
  }

  getSounds() {
    return this.sounds;
  }

  /**
   * This component cant run on server side
   * @returns {Boolean}
   */
  isServerSide() {
    return false;
  }

  /**
   * Compute this to JSON
   * @returns {JSON}
   */
  toJSON() {
    return {
      uuid: this.uuid,
      sounds: this.soundsJSON,
      conf: this.conf,
      type: AudioModule.TYPE,
    };
  }

  /**
   * Initialize
   * @param {AssetsManager} assetsManager local assetsManager
   * @param {Shared} udvShared ud-viz/Game/Shared module
   */
  initAssets(assetsManager, udvShared) {
    const _this = this;
    this.soundsJSON.forEach(function (idS) {
      _this.sounds[idS] = assetsManager.fetchSound(idS);
    });
  }

  tick(cameraMatrixWorldInverse, refOrigin) {
    const goPos = this.parent.getPosition().clone();
    goPos.add(refOrigin);
    const positionAudio = goPos.clone().applyMatrix4(cameraMatrixWorldInverse);

    for (let key in this.sounds) {
      const sound = this.sounds[key];
      if (this.conf.autoplay && !sound.playing()) sound.play();

      //https://github.com/goldfire/howler.js#documentation
      if (this.conf.spatialized) {
        sound.pos(positionAudio.x, positionAudio.y, positionAudio.z);
      }
    }
  }

  getUUID() {
    return this.uuid;
  }
};

AudioModule.TYPE = 'Audio';

module.exports = AudioModule;
