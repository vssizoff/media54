/**
 * @module WrapChimera
 */

const WebChimera = require('./WebChimera')
const VlcPlayer = require('./VlcPlayer')
const VlcAudio = require('./VlcAudio')
const VlcPlaylist = require('./VlcPlaylist')
const VlcInput = require('./VlcInput')
const VlcSubtitles = require('./VlcSubtitles')
const VlcVideo = require('./VlcVideo')
const VlcEnums = require('./VlcEnums')

module.exports = {
    chimera: new WebChimera(),
    VlcPlayer,
    VlcAudio,
    VlcPlaylist,
    VlcInput,
    VlcSubtitles,
    VlcVideo,
    enums: VlcEnums,
}

// export chimera from "./WebChimera"
// export VlcPlayer from "./VlcPlayer"
// export VlcAudio from "./VlcAudio"
// export VlcPlaylist from "./VlcPlaylist"
// export VlcInput from "./VlcInput"
// export VlcSubtitles from "./VlcSubtitles"
// export VlcVideo from "./VlcVideo"
// export enums from "./VlcEnums"