import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../lib/i18n';
afterEach(cleanup);

// jsdom has no native dialog lifecycle; model visibility for interaction tests.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
