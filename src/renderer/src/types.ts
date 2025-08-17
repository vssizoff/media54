import * as mm from "music-metadata";

export type UploadedFile = {
    file: string,
    path: string,
    filename: string
} & ({
    type: "image" | "other",
    meta: undefined
} | {
    type: "audio" | "video",
    meta: mm.ICommonTagsResult
})

export type CollectionFile = {
    title: string,
    type: "image" | "other" | "label" | "audio" | "video",
    file: string,
};

export type MediaFile = CollectionFile & {
    playing: boolean,
    editing: boolean
};