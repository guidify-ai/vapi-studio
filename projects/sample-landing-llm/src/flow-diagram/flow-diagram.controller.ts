import {
  Body,
  Controller,
  Get,
  Header,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FlowDiagramService } from './flow-diagram.service';
import { loadProjectIdentity } from '../project/project.config';

@Controller('flow')
export class FlowDiagramController {
  constructor(private readonly diagrams: FlowDiagramService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(@Res() res: Response): void {
    const identity = loadProjectIdentity(this.diagrams.configDir());
    let html = readFileSync(
      join(this.diagrams.configDir(), 'flow-diagram.html'),
      'utf8',
    );
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${identity.name} — Flow Studio</title>`,
    );
    res.send(html);
  }

  @Get('graph')
  graph() {
    return this.diagrams.buildGraph();
  }

  @Put('edges')
  saveEdges(
    @Body()
    body: {
      edges?: Array<{ source: string; target: string; label?: string }>;
    },
  ) {
    return this.diagrams.saveEdges(body?.edges ?? []);
  }
}
