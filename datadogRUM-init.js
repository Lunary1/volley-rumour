import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';
                    
datadogRum.init({
    applicationId: '8b685d1a-3a6a-431a-8e4f-14920e8c36f0',
    clientToken: 'pube11a373d1902b15309209dff89858dab',
    site: 'datadoghq.eu',
    service: '<SERVICE-NAME>',
    env: '<ENV-NAME>',
    version: '<VERSION-NUMBER>',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true,
    plugins: [reactPlugin({ router: false })],
});