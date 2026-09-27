import { IsBoolean } from 'class-validator';

export class ReviewEvaluationDto {
  @IsBoolean()
  revisada: boolean;
}