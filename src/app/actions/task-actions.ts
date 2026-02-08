
'use server';

import { saveCollectionRecord, deleteCollectionRecord, getCollectionData } from './mysql-actions';
import { Task, TaskComment, DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Speichert oder aktualisiert eine Aufgabe.
 */
export async function saveTaskAction(task: Partial<Task>, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  const isNew = !task.id;
  const id = task.id || `task-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const data = {
    ...task,
    id,
    createdAt: task.createdAt || now,
    updatedAt: now,
    status: task.status || 'todo',
    priority: task.priority || 'medium'
  } as Task;

  try {
    const res = await saveCollectionRecord('tasks', id, data, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: data.tenantId || 'global',
        actorUid: actorEmail,
        action: isNew ? `Aufgabe erstellt: ${data.title}` : `Aufgabe aktualisiert: ${data.title}`,
        entityType: 'task',
        entityId: id,
        after: data
      });
    }
    return { success: true, taskId: id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Fügt einen Kommentar zu einer Aufgabe hinzu.
 */
export async function addTaskCommentAction(comment: Omit<TaskComment, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `tcom-${Math.random().toString(36).substring(2, 9)}`;
  const data = { ...comment, id, createdAt: new Date().toISOString() };
  return await saveCollectionRecord('task_comments', id, data, dataSource);
}

/**
 * Löscht eine Aufgabe und alle Kommentare.
 */
export async function deleteTaskAction(taskId: string, dataSource: DataSource = 'mysql') {
  try {
    const commentsRes = await getCollectionData('task_comments', dataSource);
    const relatedComments = commentsRes.data?.filter(c => c.taskId === taskId) || [];
    for (const c of relatedComments) {
      await deleteCollectionRecord('task_comments', c.id, dataSource);
    }
    return await deleteCollectionRecord('tasks', taskId, dataSource);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
