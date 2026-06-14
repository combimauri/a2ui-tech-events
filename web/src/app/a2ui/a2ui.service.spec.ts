import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { A2uiService } from './a2ui.service';

describe('A2uiService', () => {
  let svc: A2uiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    svc = TestBed.inject(A2uiService);
  });

  it('applies createSurface + updateComponents into the flat node map', () => {
    svc.applyAll([
      { version: 'v0.9', createSurface: { surfaceId: 's' } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'root', component: 'Text', text: 'hi' }],
        },
      },
    ]);
    expect(svc.node('s', 'root')?.component).toBe('Text');
  });

  it('resolves JSON-pointer bindings against the data model', () => {
    svc.applyAll([
      { version: 'v0.9', createSurface: { surfaceId: 's' } },
      { version: 'v0.9', updateDataModel: { surfaceId: 's', value: { event: { title: 'Ng' } } } },
    ]);
    expect(svc.resolve('s', { path: '/event/title' })).toBe('Ng');
    expect(svc.resolve('s', 'literal')).toBe('literal');
  });

  it('writes input edits back through setValue', () => {
    svc.applyAll([
      { version: 'v0.9', createSurface: { surfaceId: 's' } },
      { version: 'v0.9', updateDataModel: { surfaceId: 's', value: { event: {} } } },
    ]);
    svc.setValue('s', '/event/title', 'New title');
    expect(svc.resolve('s', { path: '/event/title' })).toBe('New title');
  });

  it('clears a surface', () => {
    svc.applyAll([{ version: 'v0.9', createSurface: { surfaceId: 's' } }]);
    expect(svc.surface('s')).toBeTruthy();
    svc.clear('s');
    expect(svc.surface('s')).toBeUndefined();
  });
});
