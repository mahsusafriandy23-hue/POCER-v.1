import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Admin sets an outlet's map point + coverage radius (the map-pin UI lives in the internal app). */
export class UpdateOutletLocationDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  serviceRadiusKm?: number;
}
