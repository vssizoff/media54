/**
 * @module WrapChimera
 */

// let wc = require('electron').remote.require('wcjs-prebuilt');
// const wc = window.electronRemote.require('wcjs-prebuilt');

// const wc = require('./WebChimera.js.x64')
// const wc2 = require('node-loader!./WebChimera.js.x64.node')
// import wc2 from 'node-loader!./WebChimera.js.x64.node'
// import wc2 from 'node-loader!./WebChimera.js.x64'

// console.log('wc2', wc2);

// const wc = require('electron').remote.require('wcjs-prebuilt');
// const wc = require('wcjs-prebuilt')
import VlcPlayer from "./VlcPlayer";

/**
 * Main WebChimera control
 */
class WebChimera {
    /**
     * Create a VLC player object
     * @param {...string} options Initialization options
     * @returns {VlcPlayer}
     */
    async createPlayer(...options) {
        let player = await window.electron.ipcRenderer.invoke("createPlayer", options);
        return new VlcPlayer(player)
    }
}

export default WebChimera
