package it.eng.spagobi.behaviouralmodel.analyticaldriver.dao;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.hibernate.HibernateException;
import org.hibernate.Query;
import org.hibernate.Session;
import org.hibernate.Transaction;

import it.eng.spagobi.behaviouralmodel.analyticaldriver.bo.MetaModelParuse;
import it.eng.spagobi.behaviouralmodel.analyticaldriver.metadata.SbiMetaModelParameter;
import it.eng.spagobi.behaviouralmodel.analyticaldriver.metadata.SbiMetamodelParuse;
import it.eng.spagobi.behaviouralmodel.analyticaldriver.metadata.SbiParuse;
import it.eng.spagobi.commons.constants.SpagoBIConstants;
import it.eng.spagobi.commons.dao.AbstractHibernateDAO;
import it.eng.spagobi.commons.utilities.SpagoBITracer;
import it.eng.spagobi.utilities.exceptions.SpagoBIRuntimeException;

public class MetaModelParuseDAOHibImpl extends AbstractHibernateDAO implements IMetaModelParuseDAO {

	@Override
	public List loadMetaModelParuseById(Integer metaModelParuseId) {
		List<MetaModelParuse> metaModelParuses = new ArrayList();
		MetaModelParuse toReturn = null;
		Session session = null;
		Transaction transaction = null;
		try {
			session = getSession();
			transaction = session.beginTransaction();

			String hql = "from SbiMetaModelParuse s where s.paruseId=? " + " order by s.prog";

			Query query = session.createQuery(hql);
			query.setInteger(0, metaModelParuseId.intValue());

			List sbiMetaModelParuses = query.list();
			if (sbiMetaModelParuses == null)
				return metaModelParuses;
			Iterator itersbiOP = sbiMetaModelParuses.iterator();
			while (itersbiOP.hasNext()) {
				SbiMetamodelParuse sbiMetamodelParuse = (SbiMetamodelParuse) itersbiOP.next();
				MetaModelParuse metaModelParuse = toMetaModelParuse(sbiMetamodelParuse);
				metaModelParuses.add(metaModelParuse);
			}
			transaction.commit();
		} catch (HibernateException he) {
			logException(he);
			if (transaction != null)
				transaction.rollback();
			throw new SpagoBIRuntimeException(he.getMessage(), he);
		} finally {
			if (session != null) {
				if (session.isOpen())
					session.close();
			}
		}
		return metaModelParuses;
	}

	@Override
	public void modifyMetaModelParuse(MetaModelParuse aMetaModelParuse) throws HibernateException {
		Session aSession = null;
		Transaction tx = null;
		try {
			aSession = getSession();
			tx = aSession.beginTransaction();

			String hql = "from SbiMetamodelParuse s  where s.paruseId=? ";

			Query hqlQuery = aSession.createQuery(hql);
			hqlQuery.setInteger(0, aMetaModelParuse.getParuseId().intValue());

			SbiMetamodelParuse sbiMetamodelParuse = (SbiMetamodelParuse) hqlQuery.uniqueResult();
			if (sbiMetamodelParuse == null) {
				SpagoBITracer.major(SpagoBIConstants.NAME_MODULE, this.getClass().getName(), "modifyMetaModelParuse",
						"the MetaModelParuse with id " + aMetaModelParuse.getParuseId() + " does not exist.");
			}

			SbiMetaModelParameter metaModelParameter = (SbiMetaModelParameter) aSession.load(SbiMetaModelParameter.class, aMetaModelParuse.getMetamodelParId());
			SbiParuse sbiParuse = (SbiParuse) aSession.load(SbiParuse.class, aMetaModelParuse.getParuseId());
			SbiMetaModelParameter sbiMetaModelParFather = (SbiMetaModelParameter) aSession.load(SbiMetaModelParameter.class,
					aMetaModelParuse.getMetaModelParFatherId());

			sbiMetamodelParuse.setFilterColumn(aMetaModelParuse.getFilterColumn());
			sbiMetamodelParuse.setFilterOperation(aMetaModelParuse.getFilterOperation());
			sbiMetamodelParuse.setLogicOperator(aMetaModelParuse.getLogicOperator());
			sbiMetamodelParuse.setPostCondition(aMetaModelParuse.getPostCondition());
			sbiMetamodelParuse.setPreCondition(aMetaModelParuse.getPreCondition());
			sbiMetamodelParuse.setProg(aMetaModelParuse.getProg());
			sbiMetamodelParuse.setSbiMetaModelPar(metaModelParameter);

			if (sbiMetaModelParFather == null) {
				SpagoBITracer.major(SpagoBIConstants.NAME_MODULE, this.getClass().getName(), "modifyMetaModelParuse",
						"the MetaModelParameter with " + "id=" + aMetaModelParuse.getMetaModelParFatherId() + " does not exist.");
			}

			sbiMetamodelParuse.setSbiMetaModelParFather(sbiMetaModelParFather);
			sbiMetamodelParuse.setSbiParuse(sbiParuse);

			updateSbiCommonInfo4Update(sbiMetamodelParuse);
			aSession.update(sbiMetamodelParuse);
			tx.commit();
		} catch (HibernateException he) {
			logException(he);
			if (tx != null)
				tx.rollback();
			throw new HibernateException(he.getLocalizedMessage(), he);
		} finally {
			if (aSession != null) {
				if (aSession.isOpen())
					aSession.close();
			}
		}

	}

	@Override
	public void insertMetaModelParuse(MetaModelParuse aMetaModelParuse) throws HibernateException {
		Session aSession = null;
		Transaction tx = null;
		try {
			aSession = getSession();
			tx = aSession.beginTransaction();
			SbiMetaModelParameter sbiMetamodelPar = (SbiMetaModelParameter) aSession.load(SbiMetaModelParameter.class, aMetaModelParuse.getMetamodelParId());
			SbiParuse sbiParuse = (SbiParuse) aSession.load(SbiParuse.class, aMetaModelParuse.getParuseId());
			SbiMetaModelParameter sbiMetamodelParFather = (SbiMetaModelParameter) aSession.load(SbiMetaModelParameter.class,
					aMetaModelParuse.getMetaModelParFatherId());
			if (sbiMetamodelParFather == null) {
				SpagoBITracer.major(SpagoBIConstants.NAME_MODULE, this.getClass().getName(), "modifyMetaModelParuse",
						"the BIMetaMOdelParameter with " + "id=" + aMetaModelParuse.getMetaModelParFatherId() + " does not exist.");

			}
			SbiMetamodelParuse newHibMetaModel = new SbiMetamodelParuse();
			newHibMetaModel.setSbiMetaModelPar(sbiMetamodelPar);
			newHibMetaModel.setSbiParuse(sbiParuse);
			newHibMetaModel.setSbiMetaModelParFather(sbiMetamodelParFather);
			newHibMetaModel.setFilterOperation(aMetaModelParuse.getFilterOperation());

			newHibMetaModel.setProg(aMetaModelParuse.getProg());
			newHibMetaModel.setFilterColumn(aMetaModelParuse.getFilterColumn());
			newHibMetaModel.setPreCondition(aMetaModelParuse.getPreCondition());
			newHibMetaModel.setPostCondition(aMetaModelParuse.getPostCondition());
			newHibMetaModel.setLogicOperator(aMetaModelParuse.getLogicOperator());
			updateSbiCommonInfo4Insert(newHibMetaModel);
			aSession.save(newHibMetaModel);
			tx.commit();
		} catch (HibernateException he) {
			logException(he);
			if (tx != null)
				tx.rollback();
			throw new HibernateException(he.getLocalizedMessage(), he);
		} finally {
			if (aSession != null) {
				if (aSession.isOpen())
					aSession.close();
			}
		}

	}

	@Override
	public void eraseMetaModelParuse(MetaModelParuse aMetaModelParuse) throws HibernateException {
		Session aSession = null;
		Transaction tx = null;
		try {
			aSession = getSession();
			tx = aSession.beginTransaction();

			String hql = "from SbiMetamodelParuse s where s.paruseId = ? ";
			Query hqlQuery = aSession.createQuery(hql);
			hqlQuery.setInteger(0, aMetaModelParuse.getParuseId().intValue());

			SbiMetamodelParuse sbiMetamodelParuse = (SbiMetamodelParuse) hqlQuery.uniqueResult();
			if (sbiMetamodelParuse == null) {
				SpagoBITracer.major(SpagoBIConstants.NAME_MODULE, this.getClass().getName(), "eraseMetaModelParuse",
						"the MetaModelParuse with " + "id=" + aMetaModelParuse.getParuseId() + " does not exist.");
			}
			aSession.delete(sbiMetamodelParuse);
			tx.commit();
		} catch (HibernateException he) {
			logException(he);
			if (tx != null)
				tx.rollback();
			throw new HibernateException(he.getLocalizedMessage(), he);
		} finally {
			if (aSession != null) {
				if (aSession.isOpen())
					aSession.close();
			}
		}
	}

	@Override
	public List loadAllParuses(Integer metaModelParId) {

		List toReturn = new ArrayList();
		Session aSession = null;
		Transaction tx = null;
		try {
			aSession = getSession();
			tx = aSession.beginTransaction();
			String hql = "from SbiMetamodelParuse s where s.sbiMetaModelPar.metaModelParId = ? order by s.prog";
			Query hqlQuery = aSession.createQuery(hql);
			hqlQuery.setInteger(0, metaModelParId.intValue());
			List sbiMetaModelParuses = hqlQuery.list();
			Iterator it = sbiMetaModelParuses.iterator();
			while (it.hasNext()) {
				toReturn.add(toMetaModelParuse((SbiMetamodelParuse) it.next()));
			}
			tx.commit();
		} catch (HibernateException he) {
			logException(he);
			if (tx != null)
				tx.rollback();
			throw new HibernateException(he.getLocalizedMessage(), he);
		} finally {
			if (aSession != null) {
				if (aSession.isOpen())
					aSession.close();
			}
		}
		return toReturn;
	}

	@Override
	public List loadMetaModelParusesFather(Integer metaModelParId) throws HibernateException {
		List toReturn = new ArrayList();
		Session aSession = null;
		Transaction tx = null;
		try {
			aSession = getSession();
			tx = aSession.beginTransaction();
			String hql = "from SbiMetamodelParuse s where s.sbiMetaModelParFather.metaModelParId = ? order by s.prog";
			Query hqlQuery = aSession.createQuery(hql);
			hqlQuery.setInteger(0, metaModelParId.intValue());
			List sbiMetaModelParuses = hqlQuery.list();
			Iterator it = sbiMetaModelParuses.iterator();
			while (it.hasNext()) {
				toReturn.add(toMetaModelParuse((SbiMetamodelParuse) it.next()));
			}
			tx.commit();
		} catch (HibernateException he) {
			logException(he);
			if (tx != null)
				tx.rollback();
			throw new HibernateException(he.getLocalizedMessage(), he);
		} finally {
			if (aSession != null) {
				if (aSession.isOpen())
					aSession.close();
			}
		}
		return toReturn;
	}

	public MetaModelParuse toMetaModelParuse(SbiMetamodelParuse aSbiMetamodelParuse) {
		if (aSbiMetamodelParuse == null)
			return null;
		MetaModelParuse toReturn = new MetaModelParuse();
		toReturn.setMetamodelParId(aSbiMetamodelParuse.getSbiMetaModelPar().getMetaModelParId());
		toReturn.setParuseId(aSbiMetamodelParuse.getParuseId());
		toReturn.setProg(aSbiMetamodelParuse.getProg());
		toReturn.setMetaModelParFatherId(aSbiMetamodelParuse.getSbiMetaModelParFather().getMetaModelParId());
		toReturn.setFilterColumn(aSbiMetamodelParuse.getFilterColumn());
		toReturn.setFilterOperation(aSbiMetamodelParuse.getFilterOperation());
		toReturn.setPreCondition(aSbiMetamodelParuse.getPreCondition());
		toReturn.setPostCondition(aSbiMetamodelParuse.getPostCondition());
		toReturn.setLogicOperator(aSbiMetamodelParuse.getLogicOperator());
		toReturn.setMetaModelParFatherUrlName(aSbiMetamodelParuse.getSbiMetaModelParFather().getParurlNm());
		return toReturn;
	}

}