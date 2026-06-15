export default class Utils {
    static msToTime(ms, keepMs = false) {
        if (isNaN(ms)) return `00:00${keepMs ? '.00' : ''}`;

        let hms = new Date(ms)
            .toISOString()
            .substr(11, keepMs ? 11 : 8)
            .replace(/^0+/, '');

        hms = hms.startsWith(':') ? hms.substr(1) : hms;
        return hms.startsWith('00') ? hms.substr(1) : hms;
    }

    static iconUrl(icon) {
        return `https://fonts.gstatic.com/s/i/materialicons/${icon}/v6/24px.svg?download=true`;
    }

    static async nativeIcon(icon) {
        return await Utils.getSvgIcon(Utils.iconUrl(icon));
    }

    static async getSvgIcon(url, width = 18, height = 18) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                canvas.width = width;
                canvas.height = height;

                context.drawImage(img, 0, 0, width, height);
                const black = canvas.toDataURL();

                const imgData = context.getImageData(0, 0, img.width, img.height);
                for (let i = 0; i < imgData.data.length; i += 4) {
                    imgData.data[i] = 255 - imgData.data[i];
                    imgData.data[i + 1] = 255 - imgData.data[i + 1];
                    imgData.data[i + 2] = 255 - imgData.data[i + 2];
                }

                context.putImageData(imgData, 0, 0);
                const white = canvas.toDataURL();

                resolve({ black, white });
            };

            img.onerror = reject;
        });
    }
}