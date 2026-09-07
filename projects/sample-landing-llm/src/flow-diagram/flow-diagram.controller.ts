import {
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { FlowDiagramService } from './flow-diagram.service';

@Controller('flow')
export class FlowDiagramController {
  constructor(private readonly diagrams: FlowDiagramService) {}

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
