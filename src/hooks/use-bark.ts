// hooks/useBark.ts
import { useCallback } from 'react';
import axios from 'axios';
import { getToken } from '../utils/config';

export const useBark = () => {
  const synthesizeBarkSpeech = useCallback(
    async ({
      inputText,
      voicePreset,
    }: {
      inputText: string;
      voicePreset: string | undefined;
    }) => {
      const options = {
        method: 'POST',
        url: `${
          import.meta.env.VITE_BARK_URL || getToken('BARK_URL')
        }/bark-inference`,
        headers: {
          'content-type': 'application/json',
        },
        data: {
          text: inputText,
          voice: voicePreset,
        },
        responseType: 'arraybuffer' as 'json',
      };

      const speechDetails = await axios.request(options);
      return speechDetails.data;
    },
    [],
  );

  return synthesizeBarkSpeech;
};
