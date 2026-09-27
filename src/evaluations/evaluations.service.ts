import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { SubmitInstrumentDto } from './dto/submit-instrument.dto.js';

const ROL_PACIENTE = 1;
const ROL_PSICOLOGO = 2;
const ROL_ADMINISTRADOR = 3;

interface AuthenticatedUser {
  userId: number;
  correo: string;
  rol: number;
}

interface InstrumentInfo {
  id_instrumento: number;
  codigo: string;
  numero_reactivos: number;
  puntaje_min: number;
  puntaje_max: number;
  activo: boolean;
}

interface CalculatedResult {
  puntajeTotal: number;
  nivel: number | null;
  alertaPrioritaria: boolean;
}

@Injectable()
export class EvaluationsService {
  constructor(private readonly db: DatabaseService) {}

  async findInstruments() {
    return this.db.executeQuery(
      `SELECT
          id_instrumento,
          codigo,
          nombre,
          numero_reactivos,
          puntaje_min,
          puntaje_max,
          version,
          activo
       FROM dbo.Instrumentos
       WHERE activo = 1
       ORDER BY id_instrumento`,
    );
  }

  async createEvaluation(
    requestedPatientId: number | undefined,
    user: AuthenticatedUser,
  ) {
    const idPaciente =
      user.rol === ROL_PACIENTE
        ? user.userId
        : requestedPatientId;

    if (!idPaciente) {
      throw new BadRequestException(
        'Debe especificarse el paciente',
      );
    }

    if (
      user.rol !== ROL_PACIENTE &&
      user.rol !== ROL_PSICOLOGO &&
      user.rol !== ROL_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'No tienes autorización para crear evaluaciones',
      );
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      !(await this.isAssignedPsychologist(
        idPaciente,
        user.userId,
      ))
    ) {
      throw new ForbiddenException(
        'El paciente no está asignado a este psicólogo',
      );
    }

    await this.ensurePatientExists(idPaciente);

    const existing = await this.db.executeQuery(
      `SELECT TOP (1) id_evaluacion
       FROM dbo.Evaluaciones
       WHERE id_paciente = @idPaciente
         AND estado = 1
       ORDER BY fecha_inicio DESC`,
      [{ name: 'idPaciente', value: idPaciente }],
    );

    if (existing[0]) {
      throw new ConflictException(
        'El paciente ya tiene una evaluación abierta',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.Evaluaciones (
         id_paciente
       )
       OUTPUT INSERTED.id_evaluacion
       VALUES (
         @idPaciente
       )`,
      [{ name: 'idPaciente', value: idPaciente }],
    );

    return this.findById(
      rows[0].id_evaluacion,
      user,
    );
  }

  async findById(
    idEvaluacion: number,
    user: AuthenticatedUser,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          v.*,
          u.nombre AS paciente
       FROM dbo.vw_EvaluacionTresResultados v
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = v.id_paciente
       WHERE v.id_evaluacion = @idEvaluacion`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
      ],
    );

    const evaluation = rows[0];

    if (!evaluation) {
      throw new NotFoundException(
        'Evaluación no encontrada',
      );
    }

    await this.ensureEvaluationAccess(
      evaluation.id_paciente,
      user,
    );

    return evaluation;
  }

  async findByPatient(
    idPaciente: number,
    user: AuthenticatedUser,
  ) {
    await this.ensureEvaluationAccess(
      idPaciente,
      user,
    );

    return this.db.executeQuery(
      `SELECT *
       FROM dbo.vw_EvaluacionTresResultados
       WHERE id_paciente = @idPaciente
       ORDER BY fecha_inicio DESC`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );
  }

  async findAssignedToPsychologist(
    idPsicologo: number,
    user: AuthenticatedUser,
    onlyPendingReview = false,
  ) {
    if (
      user.rol !== ROL_ADMINISTRADOR &&
      !(
        user.rol === ROL_PSICOLOGO &&
        user.userId === idPsicologo
      )
    ) {
      throw new ForbiddenException(
        'No puedes consultar las evaluaciones de otro psicólogo',
      );
    }

    return this.db.executeQuery(
      `SELECT
          v.*,
          u.nombre AS paciente,
          p.num_control_o_num_empleado,
          p.tipo_persona
       FROM dbo.vw_EvaluacionTresResultados v
       INNER JOIN dbo.PacientePsicologo pp
         ON pp.id_paciente = v.id_paciente
        AND pp.id_psicologo = @idPsicologo
        AND pp.fecha_fin IS NULL
       INNER JOIN dbo.Pacientes p
         ON p.id_paciente = v.id_paciente
       INNER JOIN dbo.Usuarios u
         ON u.id_usuario = v.id_paciente
       WHERE (
         @soloPendientes = 0
         OR v.requiere_revision = 1
       )
       ORDER BY
         v.alerta_prioritaria DESC,
         v.fecha_inicio DESC`,
      [
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
        {
          name: 'soloPendientes',
          value: onlyPendingReview,
        },
      ],
    );
  }

  async startInstrument(
    idEvaluacion: number,
    idInstrumento: number,
    user: AuthenticatedUser,
  ) {
    const evaluation = await this.getEvaluationRaw(
      idEvaluacion,
    );

    await this.ensureEvaluationAccess(
      evaluation.id_paciente,
      user,
    );

    if (evaluation.estado !== 1) {
      throw new BadRequestException(
        'La evaluación no está abierta',
      );
    }

    const instrument =
      await this.getInstrument(idInstrumento);

    if (!instrument.activo) {
      throw new BadRequestException(
        'El instrumento no está disponible',
      );
    }

    const existing = await this.db.executeQuery(
      `SELECT
          id_aplicacion,
          estado
       FROM dbo.AplicacionesInstrumento
       WHERE id_evaluacion = @idEvaluacion
         AND id_instrumento = @idInstrumento`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
        {
          name: 'idInstrumento',
          value: idInstrumento,
        },
      ],
    );

    if (existing[0]) {
      if (existing[0].estado === 1) {
        return existing[0];
      }

      throw new ConflictException(
        'El instrumento ya fue registrado en esta evaluación',
      );
    }

    const rows = await this.db.executeQuery(
      `INSERT INTO dbo.AplicacionesInstrumento (
         id_evaluacion,
         id_instrumento
       )
       OUTPUT
         INSERTED.id_aplicacion,
         INSERTED.id_evaluacion,
         INSERTED.id_instrumento,
         INSERTED.fecha_inicio,
         INSERTED.estado
       VALUES (
         @idEvaluacion,
         @idInstrumento
       )`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
        {
          name: 'idInstrumento',
          value: idInstrumento,
        },
      ],
    );

    return rows[0];
  }

  async getApplication(
    idAplicacion: number,
    user: AuthenticatedUser,
  ) {
    const applications = await this.db.executeQuery(
      `SELECT
          ai.*,
          i.codigo,
          i.nombre,
          i.numero_reactivos,
          e.id_paciente
       FROM dbo.AplicacionesInstrumento ai
       INNER JOIN dbo.Instrumentos i
         ON i.id_instrumento = ai.id_instrumento
       INNER JOIN dbo.Evaluaciones e
         ON e.id_evaluacion = ai.id_evaluacion
       WHERE ai.id_aplicacion = @idAplicacion`,
      [
        {
          name: 'idAplicacion',
          value: idAplicacion,
        },
      ],
    );

    const application = applications[0];

    if (!application) {
      throw new NotFoundException(
        'Aplicación no encontrada',
      );
    }

    await this.ensureEvaluationAccess(
      application.id_paciente,
      user,
    );

    const answers = await this.db.executeQuery(
      `SELECT
          numero_reactivo,
          valor
       FROM dbo.RespuestasInstrumento
       WHERE id_aplicacion = @idAplicacion
       ORDER BY numero_reactivo`,
      [
        {
          name: 'idAplicacion',
          value: idAplicacion,
        },
      ],
    );

    return {
      ...application,
      respuestas: answers,
    };
  }

  async submitInstrument(
    idAplicacion: number,
    dto: SubmitInstrumentDto,
    user: AuthenticatedUser,
  ) {
    const application =
      await this.getApplicationRaw(idAplicacion);

    await this.ensureEvaluationAccess(
      application.id_paciente,
      user,
    );

    if (user.rol !== ROL_PACIENTE) {
      throw new ForbiddenException(
        'Solo el paciente puede responder el instrumento',
      );
    }

    if (user.userId !== application.id_paciente) {
      throw new ForbiddenException(
        'No puedes responder el instrumento de otro paciente',
      );
    }

    if (application.evaluacion_estado !== 1) {
      throw new BadRequestException(
        'La evaluación no está abierta',
      );
    }

    if (application.estado !== 1) {
      throw new BadRequestException(
        'La aplicación no está en proceso',
      );
    }

    this.validateAnswers(
      application,
      dto.respuestas,
    );

    if (
      application.codigo !== 'PHQ9' &&
      dto.dificultadFuncional !== undefined
    ) {
      throw new BadRequestException(
        'La dificultad funcional solo corresponde al PHQ-9',
      );
    }

    const result = this.calculateResult(
      application.codigo,
      dto.respuestas,
    );

    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      for (const answer of dto.respuestas) {
        await transaction
          .request()
          .input(
            'idAplicacion',
            idAplicacion,
          )
          .input(
            'numeroReactivo',
            answer.numeroReactivo,
          )
          .input('valor', answer.valor)
          .query(`
            INSERT INTO dbo.RespuestasInstrumento (
              id_aplicacion,
              numero_reactivo,
              valor
            )
            VALUES (
              @idAplicacion,
              @numeroReactivo,
              @valor
            )
          `);
      }

      await transaction
        .request()
        .input(
          'idAplicacion',
          idAplicacion,
        )
        .input(
          'puntajeTotal',
          result.puntajeTotal,
        )
        .input('nivel', result.nivel)
        .input(
          'dificultadFuncional',
          dto.dificultadFuncional ?? null,
        )
        .input(
          'alertaPrioritaria',
          result.alertaPrioritaria,
        )
        .query(`
          UPDATE dbo.AplicacionesInstrumento
          SET
            fecha_fin = SYSUTCDATETIME(),
            estado = 2,
            puntaje_total = @puntajeTotal,
            nivel = @nivel,
            dificultad_funcional =
              @dificultadFuncional,
            alerta_prioritaria =
              @alertaPrioritaria
          WHERE id_aplicacion = @idAplicacion
            AND estado = 1
        `);

      if (result.alertaPrioritaria) {
        await transaction
          .request()
          .input(
            'idEvaluacion',
            application.id_evaluacion,
          )
          .query(`
            UPDATE dbo.Evaluaciones
            SET requiere_revision = 1
            WHERE id_evaluacion = @idEvaluacion
          `);
      }

      await this.closeEvaluationIfComplete(
        transaction,
        application.id_evaluacion,
      );

      await transaction.commit();

      return this.getApplication(
        idAplicacion,
        user,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async abandonApplication(
    idAplicacion: number,
    user: AuthenticatedUser,
  ) {
    const application =
      await this.getApplicationRaw(idAplicacion);

    await this.ensureEvaluationAccess(
      application.id_paciente,
      user,
    );

    if (
      user.rol === ROL_PACIENTE &&
      user.userId !== application.id_paciente
    ) {
      throw new ForbiddenException();
    }

    if (application.estado !== 1) {
      throw new BadRequestException(
        'Solo se puede abandonar una aplicación en proceso',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.AplicacionesInstrumento
       SET
         estado = 3,
         fecha_fin = SYSUTCDATETIME()
       WHERE id_aplicacion = @idAplicacion`,
      [
        {
          name: 'idAplicacion',
          value: idAplicacion,
        },
      ],
    );

    return this.getApplication(
      idAplicacion,
      user,
    );
  }

  async closeIncompleteEvaluation(
    idEvaluacion: number,
    user: AuthenticatedUser,
  ) {
    const evaluation = await this.getEvaluationRaw(
      idEvaluacion,
    );

    await this.ensureEvaluationAccess(
      evaluation.id_paciente,
      user,
    );

    if (evaluation.estado !== 1) {
      throw new BadRequestException(
        'La evaluación no está abierta',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Evaluaciones
       SET
         estado = 3,
         fecha_cierre = SYSUTCDATETIME()
       WHERE id_evaluacion = @idEvaluacion`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
      ],
    );

    return this.findById(
      idEvaluacion,
      user,
    );
  }

  async cancelEvaluation(
    idEvaluacion: number,
    user: AuthenticatedUser,
  ) {
    if (user.rol !== ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo un administrador puede anular evaluaciones',
      );
    }

    await this.getEvaluationRaw(idEvaluacion);

    const pool = this.db.getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      await transaction
        .request()
        .input('idEvaluacion', idEvaluacion)
        .query(`
          UPDATE dbo.AplicacionesInstrumento
          SET
            estado = 4,
            fecha_fin =
              COALESCE(fecha_fin, SYSUTCDATETIME())
          WHERE id_evaluacion = @idEvaluacion
            AND estado <> 4
        `);

      await transaction
        .request()
        .input('idEvaluacion', idEvaluacion)
        .query(`
          UPDATE dbo.Evaluaciones
          SET
            estado = 4,
            fecha_cierre =
              COALESCE(fecha_cierre, SYSUTCDATETIME())
          WHERE id_evaluacion = @idEvaluacion
        `);

      await transaction.commit();

      return this.findById(
        idEvaluacion,
        user,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async markReviewed(
    idEvaluacion: number,
    user: AuthenticatedUser,
  ) {
    if (
      user.rol !== ROL_PSICOLOGO &&
      user.rol !== ROL_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'Solo un psicólogo puede revisar evaluaciones',
      );
    }

    const evaluation = await this.getEvaluationRaw(
      idEvaluacion,
    );

    if (
      user.rol === ROL_PSICOLOGO &&
      !(await this.isAssignedPsychologist(
        evaluation.id_paciente,
        user.userId,
      ))
    ) {
      throw new ForbiddenException(
        'El paciente no está asignado a este psicólogo',
      );
    }

    if (user.rol === ROL_ADMINISTRADOR) {
      throw new ForbiddenException(
        'La revisión debe ser realizada por un psicólogo',
      );
    }

    await this.db.executeQuery(
      `UPDATE dbo.Evaluaciones
       SET
         requiere_revision = 0,
         revisada_por = @idPsicologo,
         fecha_revision = SYSUTCDATETIME()
       WHERE id_evaluacion = @idEvaluacion`,
      [
        {
          name: 'idPsicologo',
          value: user.userId,
        },
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
      ],
    );

    return this.findById(
      idEvaluacion,
      user,
    );
  }

  private async getInstrument(
    idInstrumento: number,
  ): Promise<InstrumentInfo> {
    const rows = await this.db.executeQuery(
      `SELECT
          id_instrumento,
          codigo,
          numero_reactivos,
          puntaje_min,
          puntaje_max,
          activo
       FROM dbo.Instrumentos
       WHERE id_instrumento = @idInstrumento`,
      [
        {
          name: 'idInstrumento',
          value: idInstrumento,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Instrumento no encontrado',
      );
    }

    return rows[0];
  }

  private async getEvaluationRaw(
    idEvaluacion: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT *
       FROM dbo.Evaluaciones
       WHERE id_evaluacion = @idEvaluacion`,
      [
        {
          name: 'idEvaluacion',
          value: idEvaluacion,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Evaluación no encontrada',
      );
    }

    return rows[0];
  }

  private async getApplicationRaw(
    idAplicacion: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT
          ai.*,
          i.codigo,
          i.numero_reactivos,
          i.puntaje_min,
          i.puntaje_max,
          e.id_paciente,
          e.estado AS evaluacion_estado
       FROM dbo.AplicacionesInstrumento ai
       INNER JOIN dbo.Instrumentos i
         ON i.id_instrumento = ai.id_instrumento
       INNER JOIN dbo.Evaluaciones e
         ON e.id_evaluacion = ai.id_evaluacion
       WHERE ai.id_aplicacion = @idAplicacion`,
      [
        {
          name: 'idAplicacion',
          value: idAplicacion,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Aplicación no encontrada',
      );
    }

    return rows[0];
  }

  private async ensurePatientExists(
    idPaciente: number,
  ) {
    const rows = await this.db.executeQuery(
      `SELECT id_paciente
       FROM dbo.Pacientes
       WHERE id_paciente = @idPaciente`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
      ],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Paciente no encontrado',
      );
    }
  }

  private async ensureEvaluationAccess(
    idPaciente: number,
    user: AuthenticatedUser,
  ) {
    if (user.rol === ROL_ADMINISTRADOR) {
      return;
    }

    if (
      user.rol === ROL_PACIENTE &&
      user.userId === idPaciente
    ) {
      return;
    }

    if (
      user.rol === ROL_PSICOLOGO &&
      (await this.isAssignedPsychologist(
        idPaciente,
        user.userId,
      ))
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tienes acceso a esta evaluación',
    );
  }

  private async isAssignedPsychologist(
    idPaciente: number,
    idPsicologo: number,
  ): Promise<boolean> {
    const rows = await this.db.executeQuery(
      `SELECT TOP (1) id_asignacion
       FROM dbo.PacientePsicologo
       WHERE id_paciente = @idPaciente
         AND id_psicologo = @idPsicologo
         AND fecha_fin IS NULL`,
      [
        {
          name: 'idPaciente',
          value: idPaciente,
        },
        {
          name: 'idPsicologo',
          value: idPsicologo,
        },
      ],
    );

    return Boolean(rows[0]);
  }

  private validateAnswers(
    instrument: {
      codigo: string;
      numero_reactivos: number;
    },
    answers: Array<{
      numeroReactivo: number;
      valor: number;
    }>,
  ) {
    if (
      answers.length !== instrument.numero_reactivos
    ) {
      throw new BadRequestException(
        `El instrumento ${instrument.codigo} requiere ` +
          `${instrument.numero_reactivos} respuestas`,
      );
    }

    const reactives = new Set(
      answers.map(
        (answer) => answer.numeroReactivo,
      ),
    );

    if (
      reactives.size !== instrument.numero_reactivos
    ) {
      throw new BadRequestException(
        'Existen reactivos duplicados',
      );
    }

    for (
      let number = 1;
      number <= instrument.numero_reactivos;
      number++
    ) {
      if (!reactives.has(number)) {
        throw new BadRequestException(
          `Falta la respuesta del reactivo ${number}`,
        );
      }
    }

    const maximumValue =
      instrument.codigo === 'PSS14' ? 4 : 3;

    const invalid = answers.some(
      (answer) =>
        answer.valor < 0 ||
        answer.valor > maximumValue,
    );

    if (invalid) {
      throw new BadRequestException(
        `Las respuestas de ${instrument.codigo} deben estar ` +
          `entre 0 y ${maximumValue}`,
      );
    }
  }

  private calculateResult(
    code: string,
    answers: Array<{
      numeroReactivo: number;
      valor: number;
    }>,
  ): CalculatedResult {
    const ordered = [...answers].sort(
      (a, b) =>
        a.numeroReactivo - b.numeroReactivo,
    );

    if (code === 'PSS14') {
      const reversedItems = new Set([
        4, 5, 6, 7, 9, 10, 13,
      ]);

      const score = ordered.reduce(
        (total, answer) =>
          total +
          (reversedItems.has(
            answer.numeroReactivo,
          )
            ? 4 - answer.valor
            : answer.valor),
        0,
      );

      return {
        puntajeTotal: score,
        nivel: null,
        alertaPrioritaria: false,
      };
    }

    const score = ordered.reduce(
      (total, answer) =>
        total + answer.valor,
      0,
    );

    if (code === 'GAD7') {
      return {
        puntajeTotal: score,
        nivel: this.calculateGad7Level(score),
        alertaPrioritaria: false,
      };
    }

    if (code === 'PHQ9') {
      const item9 = ordered.find(
        (answer) =>
          answer.numeroReactivo === 9,
      );

      return {
        puntajeTotal: score,
        nivel: this.calculatePhq9Level(score),
        alertaPrioritaria:
          Boolean(item9 && item9.valor > 0),
      };
    }

    throw new BadRequestException(
      'No existe una regla de puntuación para el instrumento',
    );
  }

  private calculateGad7Level(
    score: number,
  ): number {
    if (score <= 4) return 0;
    if (score <= 9) return 1;
    if (score <= 14) return 2;
    return 3;
  }

  private calculatePhq9Level(
    score: number,
  ): number {
    if (score <= 4) return 0;
    if (score <= 9) return 1;
    if (score <= 14) return 2;
    if (score <= 19) return 3;
    return 4;
  }

  private async closeEvaluationIfComplete(
    transaction: any,
    idEvaluacion: number,
  ) {
    const result = await transaction
      .request()
      .input('idEvaluacion', idEvaluacion)
      .query(`
        SELECT
          COUNT(*) AS total_aplicaciones,
          SUM(
            CASE
              WHEN estado = 2 THEN 1
              ELSE 0
            END
          ) AS total_completadas
        FROM dbo.AplicacionesInstrumento
        WHERE id_evaluacion = @idEvaluacion
      `);

    const totals = result.recordset[0];

    if (
      totals.total_aplicaciones === 3 &&
      totals.total_completadas === 3
    ) {
      await transaction
        .request()
        .input('idEvaluacion', idEvaluacion)
        .query(`
          UPDATE dbo.Evaluaciones
          SET
            estado = 2,
            fecha_cierre = SYSUTCDATETIME()
          WHERE id_evaluacion = @idEvaluacion
            AND estado = 1
        `);
    }
  }
}